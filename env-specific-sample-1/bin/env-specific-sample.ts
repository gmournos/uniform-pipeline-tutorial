#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { EnvSpecificSampleStack } from '../lib/env-specific-sample-stack';

const app = new cdk.App();

new EnvSpecificSampleStack(app, 'env-specific-1', {
    description: "Environment specific stack",
    environmentName: 'development',
});

