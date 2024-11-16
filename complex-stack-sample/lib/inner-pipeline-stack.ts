import { Construct } from 'constructs';
import { StackProps, Stack, Tags } from 'aws-cdk-lib';
import { TargetEnvironments, DEPLOYER_STACK_NAME_TAG, STACK_NAME_TAG, STACK_VERSION_TAG, 
    CHANGESET_RENAME_MACRO, ROLE_REASSIGN_MACRO } from '@uniform-pipelines/model';

import { DeploymentPlan, getTargetEnvironmentFromIndividualDeploymentPlan } from '../../library/model/dist';

import { CfnPipeline } from 'aws-cdk-lib/aws-codepipeline';
import * as util from './inner-pipeline-util';
import { InnerPipelineConstruct, InnerPipelineConstructProps } from './inner-pipeline-construct';

interface InnerPipelineStackProps<P extends StackProps = StackProps> extends StackProps, InnerPipelineConstructProps<P> {} 

export class InnerPipelineStack<P extends StackProps = StackProps> extends Stack {
            
    constructor(scope: Construct, id: string, props: InnerPipelineStackProps<P>) {
        super(scope, id, props);    

        const innerPipelineConstruct = new InnerPipelineConstruct(this, 'inner-pipeline-construct', props);

        DeploymentPlan.forEach( individualPlan => {
            const targetEnvironment = getTargetEnvironmentFromIndividualDeploymentPlan(individualPlan, TargetEnvironments);
            innerPipelineConstruct.createDeploymentStage(this, targetEnvironment, props);
        });

        innerPipelineConstruct.pipeline.buildPipeline();

        this.addTransform(CHANGESET_RENAME_MACRO);
        this.addTransform(ROLE_REASSIGN_MACRO);  
        util.disableTransitions(innerPipelineConstruct.pipeline.pipeline.node.defaultChild as CfnPipeline, 
            innerPipelineConstruct.stagesWithtransitionsToDisable, 'Avoid manual approval expiration after one week');

        Tags.of(innerPipelineConstruct.pipeline.pipeline).add(STACK_NAME_TAG, props.containedStackName);
        Tags.of(innerPipelineConstruct.pipeline.pipeline).add(STACK_VERSION_TAG, props.containedStackVersion);
        Tags.of(innerPipelineConstruct.pipeline.pipeline).add(DEPLOYER_STACK_NAME_TAG, this.stackName);
    }
}
