#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { ComplexStackSampleStack } from '../lib/complex-stack-sample-stack';
import { makeVersionedPipelineStackName, INNER_PIPELINE_STACK_TEMPLATE_NAME, TargetEnvironments } from '@uniform-pipelines/model';
import { InnerPipelineStack } from '../lib/inner-pipeline-stack';

const app = new cdk.App();

const inPipelines = app.node.tryGetContext('pipeline');
const containedStackDescription = app.node.tryGetContext('description');
const containedStackVersion = app.node.tryGetContext('version');
const containedStackName = app.node.tryGetContext('stackName');

const versionedDescription = `${containedStackName}:${containedStackVersion}: ${containedStackDescription}`;

if (inPipelines === 'true') {
    new InnerPipelineStack(app, INNER_PIPELINE_STACK_TEMPLATE_NAME, {
        containedStackName,
        containedStackVersion: containedStackVersion,
        containedStackClass: ComplexStackSampleStack,
        containedStackProps: {
            description: versionedDescription,
        },
        description: 'Pipeline stack to deploy Feature3',
        stackName: makeVersionedPipelineStackName(containedStackName, containedStackVersion),
        env: {
            account: TargetEnvironments.DEVOPS.account,
            region: TargetEnvironments.DEVOPS.region,
        }
    });
} else {
    new ComplexStackSampleStack(app, 'ComplexStackSampleStack', {
        description: containedStackDescription,
    });
}
