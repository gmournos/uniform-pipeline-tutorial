import * as cdk from 'aws-cdk-lib';
import { AnyPrincipal, Effect, PolicyStatement } from 'aws-cdk-lib/aws-iam';
import { BlockPublicAccess, Bucket } from 'aws-cdk-lib/aws-s3';
import { BucketDeployment, Source } from 'aws-cdk-lib/aws-s3-deployment';
import { Construct } from 'constructs';
import * as path from 'path';

export class DynamicEnvSpecificSampleStack extends cdk.Stack {
    constructor(scope: Construct, id: string, props: cdk.StackProps) {
        super(scope, id, props);
        
        // Create an S3 bucket with all public access blocks disabled
        const publicBucket = new Bucket(this, 'env-specific-2-sample-public-bucket', {
            bucketName: `env-specific-2-sample-public-bucket-${this.account}-${this.region}`,
            removalPolicy: cdk.RemovalPolicy.DESTROY, // Caution: use with care
            autoDeleteObjects: true, // Caution: use with care
            blockPublicAccess: BlockPublicAccess.BLOCK_ACLS, // Only blocks public access via ACLs
            websiteIndexDocument: 'index.html', // Set the index document for the website
        });

        // Define a bucket policy to allow public read access to all objects in the bucket
        publicBucket.addToResourcePolicy(
            new PolicyStatement({
                effect: Effect.ALLOW,
                actions: ['s3:GetObject'],
                resources: [`${publicBucket.bucketArn}/*`],
                principals: [new AnyPrincipal()], // Allows public access to all objects in the bucket
            }),
        );
        new BucketDeployment(this, 'deploy-webapp', {
            sources: [Source.asset(path.join('ui', 'dist'))],
            destinationBucket: publicBucket,
        });

    }
}
