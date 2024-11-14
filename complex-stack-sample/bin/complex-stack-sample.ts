#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { ComplexStackSampleStack } from '../lib/complex-stack-sample-stack';
import { PipelineStack } from '../lib/pipeline-construct';
import { makeVersionedPipelineStackName, INNER_PIPELINE_STACK_TEMPLATE_NAME, TargetEnvironments } from '@uniform-pipelines/model';

const app = new cdk.App();

const inPipelines = app.node.tryGetContext('pipeline');
const containedStackDescription = app.node.tryGetContext('description');
const containedStackVersion = app.node.tryGetContext('version');
const containedStackName = app.node.tryGetContext('stackName');

const versionedDescription = `${containedStackName}:${containedStackVersion}: ${containedStackDescription}`;

if (inPipelines === 'true') {
    new PipelineStack(app, INNER_PIPELINE_STACK_TEMPLATE_NAME, {
        containedStackName,
        containedStackVersion: containedStackVersion,
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
