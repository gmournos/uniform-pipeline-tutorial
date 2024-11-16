import { Provider } from 'aws-cdk-lib/custom-resources';
import { Construct } from 'constructs';
import { TargetEnvironments } from '@uniform-pipelines/model';
import { CfnOutput, CustomResource } from 'aws-cdk-lib';

export interface KmsAliasArnReaderConstructProps {
    serviceToken: string,
}

export class KmsAliasArnReaderConstruct extends Construct {
    kmsAliasProvider: Provider;
    
    constructor(scope: Construct, private id: string, private props: KmsAliasArnReaderConstructProps) {
        super(scope, id);
    }

    getKeyArn(aliasName: string, region: string) {
        const kmsAliasResource = new CustomResource(this, `${this.id}-kms-alias-resource-${region}`, {
            serviceToken: this.props.serviceToken,
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
