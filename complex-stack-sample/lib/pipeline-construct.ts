import { Construct } from 'constructs';
import { StackProps, Stack, Stage, Fn, Tags } from 'aws-cdk-lib';
import { CodeBuildStep, CodeBuildStepProps, CodePipeline, CodePipelineSource, ManualApprovalStep } from 'aws-cdk-lib/pipelines';
import { ComplexStackSampleStack } from './complex-stack-sample-stack';
import { COMMON_REPO, DOMAIN_NAME, TargetEnvironment, TargetEnvironments, 
    getTargetEnvironmentsEnvVariablesAsObject, StackExports,  INNER_PIPELINE_INPUT_FOLDER,
    makeVersionedPipelineName, DEPLOYER_STACK_NAME_TAG, STACK_DEPLOYED_AT_TAG, 
    STACK_NAME_TAG, STACK_VERSION_TAG, getSupportBucketName, getCrossRegionTargetEnvironments, getSupportKeyAliasName, CHANGESET_RENAME_MACRO, ROLE_REASSIGN_MACRO } from '@uniform-pipelines/model';
import { Bucket, IBucket } from 'aws-cdk-lib/aws-s3';
import { S3Trigger } from 'aws-cdk-lib/aws-codepipeline-actions';
import { Key } from 'aws-cdk-lib/aws-kms';
import { KmsAliasArnReaderConstruct } from '@uniform-pipelines/cdk-util';
import { Pipeline, PipelineType } from 'aws-cdk-lib/aws-codepipeline';
import { CfnPipeline } from 'aws-cdk-lib/aws-codepipeline';
import * as fs from 'fs';
import * as yaml from 'js-yaml';
import { BuildSpec, LinuxBuildImage } from 'aws-cdk-lib/aws-codebuild';

const makeDeploymentStageName = (targetEnvironment: TargetEnvironment) => {
    return `deployment-${targetEnvironment.uniqueName}-${targetEnvironment.account}-${targetEnvironment.region}`;
};

class DeploymentStage extends Stage {
    readonly containedStack: Stack;

    constructor(scope: Construct, targetEnvironment: TargetEnvironment, pipelineStackProps: PipelineStackProps) {
        super(scope, `${pipelineStackProps.containedStackName}-deployment-${targetEnvironment.uniqueName}`, {
            stageName: makeDeploymentStageName(targetEnvironment),

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
        const codeSource = CodePipelineSource.s3(sourceBucket, `${INNER_PIPELINE_INPUT_FOLDER}/${props.containedStackName}-${props.containedStackVersion}.zip`, {
            trigger: S3Trigger.NONE,
        });

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
                env: getTargetEnvironmentsEnvVariablesAsObject(),
            }),
        });

        // Add a deployment stage to TEST
        pipeline.addStage(new DeploymentStage(this, TargetEnvironments.TEST, props));

        // Add a deployment stage to ACCEPTANCE
        const deployToAcceptanceStage = new DeploymentStage(this, TargetEnvironments.ACCEPTANCE, props);
        const approvalAcceptance = {
            stackSteps: [ {
                stack: deployToAcceptanceStage.containedStack,
                changeSet: [
                    new ManualApprovalStep(`${props.containedStackName}-${props.containedStackVersion}-approval-promote-to-${TargetEnvironments.ACCEPTANCE.uniqueName}`, {
                        comment: `Approve to deploy to ${TargetEnvironments.ACCEPTANCE.uniqueName}`,
                    }),
                ],
            }],
        };
        
        pipeline.addStage(deployToAcceptanceStage, approvalAcceptance);

        // Add a deployment stage to PRODUCTION
        pipeline.addStage(new DeploymentStage(this, TargetEnvironments.PRODUCTION, props));

        pipeline.buildPipeline();

        this.addTransform(CHANGESET_RENAME_MACRO);
        this.addTransform(ROLE_REASSIGN_MACRO);  
        disableTransitions(pipeline.pipeline.node.defaultChild as CfnPipeline, 
            [makeDeploymentStageName(TargetEnvironments.ACCEPTANCE)], 'Avoid manual approval expiration after one week');

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

            const kmsAliasArnReader = new KmsAliasArnReaderConstruct(this, 'kms-alias-reader-construct', {
                serviceToken: Fn.importValue(StackExports.KMS_FINDER_PROVIDER_REF),
            });
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

const disableTransitions = (pipeline: CfnPipeline, stageNames: string[], disableReason: string) => {
    const disableTransitionsPropertyParams = stageNames.map(stageName => {
        return {
            Reason: disableReason,
            StageName: stageName,
        };
    });
    pipeline.addPropertyOverride("DisableInboundStageTransitions", disableTransitionsPropertyParams);
};

const overrideBuildSpecPropsFromBuildspecYamlFile = (defaultBuildSpecProps: CodeBuildStepProps, buildspecFilename: string) => {
    const overridingObject = yaml.load(fs.readFileSync(buildspecFilename, 'utf8')) as Record<string, any>;

    const buildSpecProps = { ...defaultBuildSpecProps } as any;

    const installCommands = overridingObject.phases?.install?.commands;
    if (installCommands) {
        buildSpecProps.installCommands = installCommands;
        delete overridingObject.phases.install.commands;
    }
    const buildCommands = overridingObject.phases?.build?.commands;
    if (buildCommands) {
        buildSpecProps.commands = buildCommands;
        delete overridingObject.phases?.build.commands;
    }

    const baseDirectory = overridingObject.artifacts?.['base-directory'];
    if (baseDirectory) {
        buildSpecProps.baseDirectory = baseDirectory;
        delete overridingObject.artifacts['base-directory'];
    }

    const buildImage = overridingObject['build-image'] as string;
    if (buildImage && LinuxBuildImage[buildImage as keyof typeof LinuxBuildImage]) {
        buildSpecProps.buildEnvironment.buildImage = LinuxBuildImage[buildImage as keyof typeof LinuxBuildImage];
    }

    buildSpecProps.partialBuildSpec = BuildSpec.fromObject(overridingObject);
    return buildSpecProps;
};