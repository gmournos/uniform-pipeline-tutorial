import { Construct } from 'constructs';
import { CfnOutput } from 'aws-cdk-lib';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import { Runtime } from 'aws-cdk-lib/aws-lambda';
import { KMS_ALIAS_FINDER_FUNCTION, PipelineRoles, StackExports  } from '@uniform-pipelines/model';
import { Effect, ManagedPolicy, PolicyStatement, Role, ServicePrincipal } from 'aws-cdk-lib/aws-iam';
import * as path from 'path';
import { Provider } from 'aws-cdk-lib/custom-resources';

export class KmsFinderResourcesConstruct extends Construct {
    serviceToken: string;
    constructor(scope: Construct, id: string) {
        super(scope, id);

        const kmsLookupRole = new Role(this, 'kms-lookup-role', {
            assumedBy: new ServicePrincipal('lambda.amazonaws.com'),
            roleName: PipelineRoles.KMS_FINDER_FUNCTION_ROLE,
        });

        kmsLookupRole.addToPolicy(
            new PolicyStatement({
                actions: ['kms:ListAliases'],
                resources: ['*'],
                effect: Effect.ALLOW,
            }),
        );
        kmsLookupRole.addManagedPolicy(ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole'));

        const kmsLookupProviderRole = new Role(this, 'kms-lookup-provider-role', {
            roleName: PipelineRoles.KMS_FINDER_PROVIDER_ROLE,
            assumedBy: new ServicePrincipal('lambda.amazonaws.com'),
        });

        kmsLookupProviderRole.addManagedPolicy(ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole'));

        // Define the Lambda function for alias lookup
        const kmsAliasLookupLambda = new NodejsFunction(this, 'kms-alias-lookup-function', {
            functionName: KMS_ALIAS_FINDER_FUNCTION,
            runtime: Runtime.NODEJS_20_X,
            handler: 'findKeyArnByAliasNameHandler',
            entry: path.join('lambda', 'kms', 'kms-key-finder.ts'),
            role: kmsLookupRole,
        });

        // Define the custom resource provider
        const kmsAliasProvider = new Provider(this, 'kms-alias-provider', {
            onEventHandler: kmsAliasLookupLambda,
            role: kmsLookupProviderRole,
        });

        new CfnOutput(this, 'kms-provider-export', {
            description: 'Uniform pipelines KMS key provider',
            value: kmsAliasProvider.serviceToken,
            exportName: StackExports.KMS_FINDER_PROVIDER_REF,
        });
        this.serviceToken = kmsAliasProvider.serviceToken;
    }
}
