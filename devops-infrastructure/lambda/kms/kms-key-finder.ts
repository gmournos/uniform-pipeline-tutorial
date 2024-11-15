import { KMSClient, ListAliasesCommand, ListAliasesCommandOutput } from '@aws-sdk/client-kms';
import { CdkCustomResourceEvent, CdkCustomResourceResponse } from 'aws-lambda';

export const findKeyArnByAliasNameHandler = async (event: CdkCustomResourceEvent): Promise<CdkCustomResourceResponse>  => {
    const aliasName = event.ResourceProperties.AliasName;
    const region = event.ResourceProperties.Region;
    const accountId = event.ResourceProperties.AccountId;
    
    if (event.RequestType !== 'Create' && event.RequestType !== 'Update') {
        return {
            PhysicalResourceId: aliasName,
            Data: {},
        };
    }

    // Initialize the KMS client with the specified region
    const kms = new KMSClient({ region });

    try {
        
        // List all KMS aliases in the specified region
        const command = new ListAliasesCommand({});
        const response = await kms.send(command) as ListAliasesCommandOutput;
        const aliases = response.Aliases ?? []; 

        // Find the alias matching the provided alias name
        const matchingAlias = aliases.find(alias => alias.AliasName === `alias/${aliasName}`);

        if (matchingAlias && matchingAlias.TargetKeyId) {
            const keyArn = `arn:aws:kms:${region}:${accountId}:key/${matchingAlias.TargetKeyId}`;

            // Return the key ARN as part of the CloudFormation response
            return {
                PhysicalResourceId: aliasName,
                Data: {
                    KeyArn: keyArn,
                },
            };
        } else {
            throw new Error(`KMS alias "${aliasName}" not found or does not have a TargetKeyId in region ${region}. Got ${JSON.stringify(aliases)}`);
        }
    } catch (error: any) {
        console.error(error);
        throw new Error(`Failed to retrieve KMS alias ARN: ${error?.message}`);
    }
};
