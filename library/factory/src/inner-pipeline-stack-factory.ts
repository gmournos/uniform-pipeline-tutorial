import { StackProps } from "aws-cdk-lib";
import { INNER_PIPELINE_STACK_TEMPLATE_NAME, makeVersionedPipelineStackName, TargetEnvironments } from "@uniform-pipelines/model";
import { InnerPipelineStack } from "./inner-pipeline-stack";
import { ContainedStackClassConstructor, ContainedStackPropsType } from "./inner-pipeline-construct";
import { Construct } from "constructs";

export class InnerPipelineStackFactory<P extends ContainedStackPropsType = StackProps> {
    buildInnerPipelineStackBase(parentScope: Construct, containedStackClass: ContainedStackClassConstructor<P>, extraContainedStackProps?: Record<string, any>) {
        const containedStackVersion = parentScope.node.tryGetContext('version');
        const containedStackName = parentScope.node.tryGetContext('stackName');
        const containedStackDescription = parentScope.node.tryGetContext('description');
        const versionedDescription = `${containedStackName}:${containedStackVersion}: ${containedStackDescription}`;
        const innerPipelineConstructProps = {
            containedStackName,
            containedStackVersion,
            containedStackClass,
            containedStackProps: {
                ...extraContainedStackProps,
                description: versionedDescription,
            } as P,
        };
        new InnerPipelineStack(parentScope, INNER_PIPELINE_STACK_TEMPLATE_NAME, {
            ...innerPipelineConstructProps,
            description: `Inner Delivery Pipeline for ${containedStackName}:${containedStackVersion}`,
            stackName: makeVersionedPipelineStackName(containedStackName, containedStackVersion),
            env: {
                account: TargetEnvironments.DEVOPS.account,
                region: TargetEnvironments.DEVOPS.region,
            }
        });
   }
}