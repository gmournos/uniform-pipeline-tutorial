import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { CodeArtifactCdkConstruct } from './codartifact-construct';

export class DevopsInfrastructureStack extends cdk.Stack {
    constructor(scope: Construct, id: string, props?: cdk.StackProps) {
        super(scope, id, props);
        new CodeArtifactCdkConstruct(this, 'codeartifact-construct');
    }
}
