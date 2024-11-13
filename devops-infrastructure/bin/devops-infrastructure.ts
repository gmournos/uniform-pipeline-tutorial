#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { DevopsInfrastructureStack } from '../lib/devops-infrastructure-stack';
import { CrossRegionSupportStackBuilder } from '../lib/cross-region-support-stack-builder';

const app = new cdk.App();
const buildSupport = app.node.tryGetContext('support');

if (buildSupport === 'true') {
    new CrossRegionSupportStackBuilder(app);
} else {
    new DevopsInfrastructureStack(app, 'devops-infrastructure-stack', {});
}