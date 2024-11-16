import { Construct } from 'constructs';
import { StackProps, Stack, Stage, Fn, Tags } from 'aws-cdk-lib';
import { CodeBuildStep, CodeBuildStepProps, CodePipeline, CodePipelineSource, ManualApprovalStep } from 'aws-cdk-lib/pipelines';
import { TargetEnvironment, TargetEnvironments, 
    INNER_PIPELINE_INPUT_FOLDER, makeVersionedPipelineName, DEPLOYER_STACK_NAME_TAG, STACK_DEPLOYED_AT_TAG, 
    STACK_NAME_TAG, STACK_VERSION_TAG, getSupportBucketName, getCrossRegionTargetEnvironments, getSupportKeyAliasName, 
    CHANGESET_RENAME_MACRO, ROLE_REASSIGN_MACRO, PIPELINES_BUILD_SPEC_DEF_FILE,
    StackExports, PIPELINES_BUILD_SPEC_POSTMAN_DEF_FILE } from '@uniform-pipelines/model';

import { DeploymentPlan, getIndividualDeploymentPlan, getTargetEnvironmentFromIndividualDeploymentPlan } from '../../library/model/dist';

import { Bucket, IBucket } from 'aws-cdk-lib/aws-s3';
import { S3Trigger } from 'aws-cdk-lib/aws-codepipeline-actions';
import { Key } from 'aws-cdk-lib/aws-kms';
import { KmsAliasArnReaderConstruct } from '@uniform-pipelines/cdk-util';
import { Pipeline, PipelineType } from 'aws-cdk-lib/aws-codepipeline';
import { CfnPipeline } from 'aws-cdk-lib/aws-codepipeline';
import * as util from './inner-pipeline-util';

const makeDeploymentStageName = (targetEnvironment: TargetEnvironment) => {
    return `deployment-${targetEnvironment.uniqueName}-${targetEnvironment.account}-${targetEnvironment.region}`;
};

export type ContainedStackClassConstructor<P extends StackProps = StackProps> = new(c: Construct, id: string, p: P) => Stack;

export interface PipelineStackProps<P extends StackProps = StackProps> extends StackProps {
    containedStackProps?: P;
    containedStackName: string;
    containedStackVersion: string;
    containedStackClass: ContainedStackClassConstructor<P>,
}

export class PipelineStack <P extends StackProps> extends Stack {
    protected readonly pipeline: CodePipeline;
    protected readonly codeSource: CodePipelineSource;
    protected readonly stagesWithtransitionsToDisable: string[] = []; 
    
    public createDeploymentStage(scope: Construct, targetEnvironment: TargetEnvironment, pipelineStackProps: PipelineStackProps<P>) {
            
        class DeploymentStage extends Stage {
            readonly containedStack: Stack;

            constructor() {
                super(scope, `${pipelineStackProps.containedStackName}-deployment-${targetEnvironment.uniqueName}`, {
                    stageName: makeDeploymentStageName(targetEnvironment),

                });
                this.containedStack = new pipelineStackProps.containedStackClass(this, 'target-stack', {
            
                    ...pipelineStackProps.containedStackProps,
                    stackName: pipelineStackProps.containedStackName,
                    env: {
                        account: targetEnvironment.account,
                        region: targetEnvironment.region,
                    }
                } as P);
                Tags.of(this.containedStack).add(STACK_VERSION_TAG, pipelineStackProps.containedStackVersion);
                Tags.of(this.containedStack).add(STACK_DEPLOYED_AT_TAG, (new Date()).toISOString());
            }
        }

        const resultStage = new DeploymentStage();
        const individualPlan = getIndividualDeploymentPlan(targetEnvironment, TargetEnvironments);
        if (individualPlan.requiresApproval) {
            this.stagesWithtransitionsToDisable.push(makeDeploymentStageName(targetEnvironment));
        }
        
        const approval = individualPlan.requiresApproval ? {
            stackSteps: [ {
                stack: resultStage.containedStack,
                changeSet: [this.makeManualApprovalStep(targetEnvironment, pipelineStackProps)],
            }],
        } : {} ;
        const stage = this.pipeline.addStage(resultStage, approval);

        if (individualPlan.shouldSmokeTest && util.hasPostmanSpec()) {
            stage.addPost(this.makePostmanCodeBuild(targetEnvironment, this.codeSource));
        }
    }

    protected makeManualApprovalStep(targetEnvironment: TargetEnvironment, pipelineStackProps: PipelineStackProps<P>) {
        
        return new ManualApprovalStep(`${pipelineStackProps.containedStackName}-approval-promote-to-${targetEnvironment.uniqueName}`, {
            comment: `Approve to deploy to ${targetEnvironment.uniqueName}`,
        });
    }

    constructor(scope: Construct, id: string, props: PipelineStackProps<P>) {
        super(scope, id, props);

        const sourceBucket = Bucket.fromBucketAttributes(this, 'pipeline-source-bucket', {
            bucketArn: Fn.importValue(StackExports.PIPELINE_SOURCE_BUCKET_ARN_REF),
        });
        this.codeSource = CodePipelineSource.s3(sourceBucket, `${INNER_PIPELINE_INPUT_FOLDER}/${props.containedStackName}-${props.containedStackVersion}.zip`, {
            trigger: S3Trigger.NONE,
        });

        // Create a new CodePipeline
        this.pipeline = new CodePipeline(this, 'cicd-pipeline', {
            codePipeline: this.createCrossRegionReplicationsBase(props),
            // Define the synthesis step
            synth: this.makeMainBuildStep(this.codeSource),
        });

        DeploymentPlan.forEach( individualPlan => {
            const targetEnvironment = getTargetEnvironmentFromIndividualDeploymentPlan(individualPlan, TargetEnvironments);
            this.createDeploymentStage(this, targetEnvironment, props);
        });

        this.pipeline.buildPipeline();

        this.addTransform(CHANGESET_RENAME_MACRO);
        this.addTransform(ROLE_REASSIGN_MACRO);  
        util.disableTransitions(this.pipeline.pipeline.node.defaultChild as CfnPipeline, 
            this.stagesWithtransitionsToDisable, 'Avoid manual approval expiration after one week');

        Tags.of(this.pipeline.pipeline).add(STACK_NAME_TAG, props.containedStackName);
        Tags.of(this.pipeline.pipeline).add(STACK_VERSION_TAG, props.containedStackVersion);
        Tags.of(this.pipeline.pipeline).add(DEPLOYER_STACK_NAME_TAG, this.stackName);
    }

    
    createCrossRegionReplicationsBase(props: PipelineStackProps<P>) {
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

    makeMainBuildStep(codeSource: CodePipelineSource) {
        const defaultBuildSpecProps = this.makeMainBuildStepDefaultBuildspec(codeSource);
        
        const buildSpecProps = util.hasBuildSpec() ? util.overrideBuildSpecPropsFromBuildspecYamlFile(defaultBuildSpecProps, PIPELINES_BUILD_SPEC_DEF_FILE) : defaultBuildSpecProps;

        return new CodeBuildStep('synth-step', buildSpecProps);
    }

    makeMainBuildStepDefaultBuildspec = (codeSource: CodePipelineSource)  => {
        return util.makeMainBuildStepDefaultBuildspec(codeSource);
    };
    
    protected makePostmanCodeBuild(targetEnvironment: TargetEnvironment, codeSource: CodePipelineSource) {
        const defaultBuildSpecProps: CodeBuildStepProps = this.makePostmanCodeBuildDefaultBuildspec(targetEnvironment, codeSource);
        const buildSpecProps = util.hasPostmanBuildSpec() ? util.overrideBuildSpecPropsFromBuildspecYamlFile(defaultBuildSpecProps,
            PIPELINES_BUILD_SPEC_POSTMAN_DEF_FILE) : defaultBuildSpecProps;
        
        return new CodeBuildStep(`test-run-postman-${targetEnvironment.uniqueName}`, buildSpecProps);
    }

    makePostmanCodeBuildDefaultBuildspec (targetEnvironment: TargetEnvironment, codeSource: CodePipelineSource) {
        return util.makePostmanCodeBuildDefaultBuildspec(targetEnvironment, codeSource);
    }
}
