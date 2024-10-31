import { Construct } from 'constructs';
import { StackProps, Stack, Stage, Fn, Tags } from 'aws-cdk-lib';
import { CodeBuildStep, CodePipeline, CodePipelineSource } from 'aws-cdk-lib/pipelines';
import { ComplexStackSampleStack } from './complex-stack-sample-stack';
import { COMMON_REPO, DOMAIN_NAME, TargetEnvironment, TargetEnvironments, getTargetEnvironmentsEnvVariablesAsObject, 
    SOURCE_CODE_KEY, StackExports } from '@uniform-pipelines/model';
import { Effect, PolicyStatement } from 'aws-cdk-lib/aws-iam';
import { Bucket, IBucket } from 'aws-cdk-lib/aws-s3';
import { S3Trigger } from 'aws-cdk-lib/aws-codepipeline-actions';
import { Key } from 'aws-cdk-lib/aws-kms';
import { KmsAliasArnReaderConstruct } from '@uniform-pipelines/cdk-util';
import { getSupportBucketName, getCrossRegionTargetEnvironments, getSupportKeyAliasName } from '@uniform-pipelines/model';
import { Pipeline, PipelineType } from 'aws-cdk-lib/aws-codepipeline';
import { makeVersionedPipelineName } from '../../library/model/src/model-functions';
import { DEPLOYER_STACK_NAME_TAG, STACK_DEPLOYED_AT_TAG, STACK_NAME_TAG, STACK_VERSION_TAG } from '../../library/model/src/model-constants';

class DeploymentStage extends Stage {
    readonly containedStack: Stack;

    constructor(scope: Construct, targetEnvironment: TargetEnvironment, pipelineStackProps: PipelineStackProps) {
        super(scope, `${pipelineStackProps.containedStackName}-deployment-${targetEnvironment.uniqueName}`, {
            stageName: `deployment-${targetEnvironment.uniqueName}-${targetEnvironment.account}-${targetEnvironment.region}`,
        });
        this.containedStack = new ComplexStackSampleStack(this, 'target-stack', {
    
            ...pipelineStackProps.containedStackProps,
            stackName: pipelineStackProps.containedStackName,
            env: {
                account: targetEnvironment.account,
                region: targetEnvironment.region,
            }
        });
        Tags.of(this.containedStack).add(STACK_VERSION_TAG, pipelineStackProps.containedStackVersion);
        Tags.of(this.containedStack).add(STACK_DEPLOYED_AT_TAG, (new Date()).toISOString());
    }
}

export interface PipelineStackProps extends StackProps {
    containedStackProps: StackProps;
    containedStackName: string;
    containedStackVersion: string;
}

export class PipelineStack extends Stack {
    constructor(scope: Construct, id: string, props: PipelineStackProps) {
        super(scope, id, props);

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
            codePipeline: this.createCrossRegionReplicationsBase(props),
            // Define the synthesis step
            synth: new CodeBuildStep('synth-step', {
                input: codeSource,
                installCommands: [
                    'npm install -g aws-cdk',
                    `aws codeartifact login --tool npm --repository ${COMMON_REPO} --domain ${DOMAIN_NAME} --domain-owner ${TargetEnvironments.DEVOPS.account}`,
                ],
                commands: ['npm ci', 'npm run build', 'npx aws-cdk synth -c pipeline=true'], // Build and synthesize the CDK app
                rolePolicyStatements: codeArtifactPermissions,
                env: getTargetEnvironmentsEnvVariablesAsObject(),
            }),
        });

        // Add a deployment stage to TEST
        pipeline.addStage(new DeploymentStage(this, TargetEnvironments.TEST, props));

        // Add a deployment stage to ACCEPTANCE
        pipeline.addStage(new DeploymentStage(this, TargetEnvironments.ACCEPTANCE, props));

        // Add a deployment stage to PRODUCTION
        pipeline.addStage(new DeploymentStage(this, TargetEnvironments.PRODUCTION, props));

        pipeline.buildPipeline();

        sourceBucket.grantRead(pipeline.pipeline.role);

        Tags.of(pipeline.pipeline).add(STACK_NAME_TAG, props.containedStackName);
        Tags.of(pipeline.pipeline).add(STACK_VERSION_TAG, props.containedStackVersion);
        Tags.of(pipeline.pipeline).add(DEPLOYER_STACK_NAME_TAG, this.stackName);

    }

    
    createCrossRegionReplicationsBase(props: PipelineStackProps) {
        const encryptionKey = Key.fromKeyArn(
            this,
            'artifact-bucket-key-arn',
            Fn.importValue(StackExports.PIPELINE_ARTIFACT_BUCKET_KEY_ARN_REF),
        );

        const artifactBucket = Bucket.fromBucketAttributes(this, 'pipeline-artifact-bucket', {
            bucketArn: Fn.importValue(StackExports.PIPELINE_ARTIFACT_BUCKET_ARN_REF),
            encryptionKey,
        });

        const crossRegionReplicationBuckets: { [region: string]: IBucket } = {
            [TargetEnvironments.DEVOPS.region] : artifactBucket,
        };

        const crossRegionEnvironments = getCrossRegionTargetEnvironments(TargetEnvironments.DEVOPS.region, TargetEnvironments);
        if (crossRegionEnvironments.size > 0) {

            const kmsAliasArnReader = new KmsAliasArnReaderConstruct(this, 'kms-alias-reader-construct');
            for (const [crossRegion, targetEnvironments] of crossRegionEnvironments) {
                
                const replicationBucket = Bucket.fromBucketAttributes(this, `replication-bucket-${crossRegion}`, {
                    bucketName: getSupportBucketName(crossRegion),
                    encryptionKey: Key.fromKeyArn(this, 'hardcoded', kmsAliasArnReader.getKeyArn(getSupportKeyAliasName(crossRegion), crossRegion)),
                });

                crossRegionReplicationBuckets[crossRegion] = replicationBucket;
            }
        }

        return new Pipeline(this, 'cross-region-replication-base', {
            pipelineType: PipelineType.V2,
            pipelineName: makeVersionedPipelineName(props.containedStackName, props.containedStackVersion),
            crossRegionReplicationBuckets,
            crossAccountKeys: false,
        });
    }
}

