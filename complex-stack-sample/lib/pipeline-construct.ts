import { Construct } from 'constructs';
import { StackProps, Stack, Stage } from 'aws-cdk-lib';
import { CodeBuildStep, CodePipeline, IFileSetProducer } from 'aws-cdk-lib/pipelines';
import { ComplexStackSampleStack } from './complex-stack-sample-stack';
import { COMMON_REPO, DOMAIN_NAME, TargetEnvironment, TargetEnvironments, getTargetEnvironmentsEnvVariablesAsObject } from '../../library/model';
import { Effect, PolicyStatement } from 'aws-cdk-lib/aws-iam';

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
    codeSource: IFileSetProducer;
    containedStackProps: StackProps;
    containedStackName: string;
}

export class PipelineStack extends Stack {
    constructor(scope: Construct, id: string, props: PipelineStackProps) {
        super(scope, id, props);

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
            pipelineName: PIPELINE_NAME,
            // Define the synthesis step
            synth: new CodeBuildStep('synth-step', {
                input: props.codeSource,
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
    }
}
