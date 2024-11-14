import { Provider } from 'aws-cdk-lib/custom-resources';
import { Construct } from 'constructs';
import { Effect, PolicyStatement, Role, ServicePrincipal, } from 'aws-cdk-lib/aws-iam';
import { TargetEnvironments } from '../../model/dist';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import { Runtime } from 'aws-cdk-lib/aws-lambda';
import * as path from 'path';
import { CfnOutput, CustomResource } from 'aws-cdk-lib';

export class KmsAliasArnReaderConstruct extends Construct {
    kmsAliasProvider: Provider;
    
    constructor(scope: Construct, private id: string) {
        super(scope, id);
        const kmsLookupRole = new Role(this, `${id}-kms-lookup-role`, {
            assumedBy: new ServicePrincipal('lambda.amazonaws.com'), // Custom resource uses a Lambda-backed implementation
        });

        kmsLookupRole.addToPolicy(
            new PolicyStatement({
                actions: ['kms:ListAliases'],
                resources: ['*'],
                effect: Effect.ALLOW,
            }),
        );
        
        // Define the Lambda function for alias lookup
        const kmsAliasLookupLambda = new NodejsFunction(this, `${id}-kms-alias-lookup-function`, {
            runtime: Runtime.NODEJS_20_X,
            handler: 'findKeyArnByAliasNameHandler',
            entry: path.join(__dirname, 'lambda', 'kms-key-finder.ts'),
            role: kmsLookupRole,
        });

        // Define the custom resource provider
        this.kmsAliasProvider = new Provider(this, `${id}-kms-alias-provider`, {
            onEventHandler: kmsAliasLookupLambda,
        });
    }

    getKeyArn(aliasName: string, region: string) {
        const kmsAliasResource = new CustomResource(this, `${this.id}-kms-alias-resource-${region}`, {
            serviceToken: this.kmsAliasProvider.serviceToken,
            properties: {
              AliasName: aliasName,
              Region: region,             
              AccountId: TargetEnvironments.DEVOPS.account,
            },
        });
        const result = kmsAliasResource.getAttString('KeyArn');
        new CfnOutput(this, `${this.id}-kms-alias-resource-result-${region}`, {
            description: `Arn of the kms key of region ${region}`,
            value: result,
        });
        return result;
    }
}
