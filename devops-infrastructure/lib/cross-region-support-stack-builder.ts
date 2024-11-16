import { Stack, App, RemovalPolicy } from 'aws-cdk-lib';
import * as kms from 'aws-cdk-lib/aws-kms';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as iam from 'aws-cdk-lib/aws-iam';
import {
    getCrossRegionTargetEnvironments,
    getSupportBucketName,
    getSupportKeyAliasName,
    getSupportStackName,
    TargetEnvironment,
    TargetEnvironments,
    makeCdkDefaultDeployRole,
} from '@uniform-pipelines/model';

export class CrossRegionSupportStackBuilder {
        
    constructor(private app: App) {
        
        const crossRegionTargetEnvironments = getCrossRegionTargetEnvironments(TargetEnvironments.DEVOPS.region, TargetEnvironments);
        for (const [region, targetEnvironments] of crossRegionTargetEnvironments) {
            this.createSupportStack(region, targetEnvironments);
        }
    }

    createSupportStack(region: string, targetEnvironments: TargetEnvironment[]) {
        const supportStack = new Stack(this.app, getSupportStackName(region), {
            env: {
                account: TargetEnvironments.DEVOPS.account,
                region: region,
            },
            stackName: getSupportStackName(region),
        });

        // Create a KMS key with removal policy
        const replicationKey = new kms.Key(supportStack, getSupportKeyAliasName(region), {
            enableKeyRotation: true,
            removalPolicy: RemovalPolicy.DESTROY,
            description: `Uniform Pipelines Replication key for region ${region}`,
            alias: getSupportKeyAliasName(region),
        });

        // Create an S3 bucket with encryption using the KMS alias key
        const bucket = new s3.Bucket(supportStack, getSupportBucketName(region), {
            bucketName: getSupportBucketName(region),
            encryptionKey: replicationKey,
            autoDeleteObjects: true,
            removalPolicy: RemovalPolicy.DESTROY,
        });

        const deployAccountPrincipals = targetEnvironments.map(
            targetEnvironment => new iam.ArnPrincipal(makeCdkDefaultDeployRole(targetEnvironment)));

        // Grant read and decrypt permissions to target accounts
        deployAccountPrincipals.forEach(deployAccountPrincipal => {
            bucket.grantRead(deployAccountPrincipal);
            replicationKey.grantDecrypt(deployAccountPrincipal);
        });
        bucket.grantReadWrite(new iam.AccountPrincipal(TargetEnvironments.DEVOPS.account));
        replicationKey.grantEncryptDecrypt(new iam.AccountPrincipal(TargetEnvironments.DEVOPS.account));
    }
}
