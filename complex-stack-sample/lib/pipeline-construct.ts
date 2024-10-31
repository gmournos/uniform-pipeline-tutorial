import { Construct } from 'constructs';
import { StackProps, Stack, Stage, Fn } from 'aws-cdk-lib';
import { CodeBuildStep, CodePipeline, CodePipelineSource } from 'aws-cdk-lib/pipelines';
import { ComplexStackSampleStack } from './complex-stack-sample-stack';
import { COMMON_REPO, DOMAIN_NAME, TargetEnvironment, TargetEnvironments, getTargetEnvironmentsEnvVariablesAsObject, SOURCE_CODE_KEY, StackExports } from '../../library/model';
import { Effect, PolicyStatement } from 'aws-cdk-lib/aws-iam';
import { Bucket } from 'aws-cdk-lib/aws-s3';
import { S3Trigger } from 'aws-cdk-lib/aws-codepipeline-actions';
import { Key } from 'aws-cdk-lib/aws-kms';

const PIPELINE_NAME = 'Feature1_Pipeline';

class DeploymentStage extends Stage {
    constructor(scope: Construct, targetEnvironment: TargetEnvironment, pipelineStackProps: PipelineStackProps) {
        super(scope, `${pipelineStackProps.containedStackName}-deployment-${targetEnvironment.uniqueName}`, {
            stageName: `deployment-${targetEnvironment.uniqueName}-${targetEnvironment.account}-${targetEnvironment.region}`,
        });
        new ComplexStackSampleStack(this, 'target-stack', {
            ...pipelineStackProps.containedStackProps,
            stackName: pipelineStackProps.containedStackName,
            env: {
                account: targetEnvironment.account,
                region: targetEnvironment.region,
            }
        });
    }
}

export interface PipelineStackProps extends StackProps {
    containedStackProps: StackProps;
    containedStackName: string;
}

export class PipelineStack extends Stack {
    constructor(scope: Construct, id: string, props: PipelineStackProps) {
        super(scope, id, props);

        const encryptionKey = Key.fromKeyArn(this, 'artifact-bucket-key-arn',
            Fn.importValue(StackExports.PIPELINE_ARTIFACT_BUCKET_KEY_ARN_REF));

        const artifactBucket = Bucket.fromBucketAttributes(this, 'pipeline-artifact-bucket', {
            bucketArn: Fn.importValue(StackExports.PIPELINE_ARTIFACT_BUCKET_ARN_REF),
            encryptionKey,
        });

        const sourceBucket = Bucket.fromBucketAttributes(this, 'pipeline-source-bucket', {
            bucketArn: Fn.importValue(StackExports.PIPELINE_SOURCE_BUCKET_ARN_REF),
        });
        const codeSource = CodePipelineSource.s3(sourceBucket, SOURCE_CODE_KEY, {
            trigger: S3Trigger.NONE,
        });

        const codeArtifactPermissions = [
            new PolicyStatement({
                sid: 'AllowArtifactoryLogin',
                effect: Effect.ALLOW,
                actions: [
                    'codeartifact:GetAuthorizationToken',
                    'codeartifact:GetRepositoryEndpoint',
                    'codeartifact:ReadFromRepository',
                ],
                resources: [
                    // Grant access only to the specific domain and repository
                    `arn:aws:codeartifact:${this.region}:${this.account}:domain/${DOMAIN_NAME}`,
                    `arn:aws:codeartifact:${this.region}:${this.account}:repository/${DOMAIN_NAME}/${COMMON_REPO}`,
                ],
            }),
            new PolicyStatement({
                sid: 'AllowCodeArtifactStsLogin',
                effect: Effect.ALLOW,
                actions: ['sts:GetServiceBearerToken'],
                resources: ['*'], // `sts:GetServiceBearerToken` targets sts service-wide
                conditions: {
                    StringEquals: {
                        'sts:AWSServiceName': 'codeartifact.amazonaws.com',
                    },
                },
            }),
        ];

        // Create a new CodePipeline
        const pipeline = new CodePipeline(this, 'cicd-pipeline', {
            artifactBucket,
            pipelineName: PIPELINE_NAME,
            // Define the synthesis step
            synth: new CodeBuildStep('synth-step', {
                input: codeSource,
                installCommands: [
                    'npm install -g aws-cdk',
                    `aws codeartifact login --tool npm --repository ${COMMON_REPO} --domain ${DOMAIN_NAME} --domain-owner ${TargetEnvironments.DEVOPS.account}`,
                ],
                commands: ['npm ci', 'npm run build', 'npx aws-cdk synth'], // Build and synthesize the CDK app
                rolePolicyStatements: codeArtifactPermissions,
                env: getTargetEnvironmentsEnvVariablesAsObject(),
            }),
        });

        // Add a deployment stage to TEST
        pipeline.addStage(new DeploymentStage(this, TargetEnvironments.TEST, props));

        pipeline.buildPipeline();

        sourceBucket.grantRead(pipeline.pipeline.role);
    }
}
