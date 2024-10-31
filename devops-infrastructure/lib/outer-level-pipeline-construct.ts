import * as cdk from 'aws-cdk-lib';
import * as codepipeline from 'aws-cdk-lib/aws-codepipeline';
import * as cpactions from 'aws-cdk-lib/aws-codepipeline-actions';
import * as codebuild from 'aws-cdk-lib/aws-codebuild';
import { Artifact, PipelineType } from 'aws-cdk-lib/aws-codepipeline';
import { Construct } from 'constructs';
import { COMMON_REPO, DOMAIN_NAME, OUTER_PIPELINE_NAME, TargetEnvironments, 
    getTargetEnvironmentsEnvVariablesAsCodeBuildObject, makeVersionedPipelineStackName, SOURCE_CODE_KEY, INNER_PIPELINE_INPUT_FOLDER } from '../../library/model/dist';
import { IRole } from 'aws-cdk-lib/aws-iam';
import { Bucket } from 'aws-cdk-lib/aws-s3';
import { Key } from 'aws-cdk-lib/aws-kms';

interface OuterLevelPipelineStackProps {
    sourceBucketArn: string;
    artifactBucketArn: string;
    artifactBucketKeyArn: string;
    templatePath: string;
    mainRole: IRole;
    actionsRole: IRole;
}

export class OuterLevelPipelineConstruct extends Construct {
    constructor(scope: cdk.App, id: string, props: OuterLevelPipelineStackProps) {
        super(scope, id);

        const sourceBucket = Bucket.fromBucketAttributes(this, 'pipeline-source-bucket', {
            bucketArn: props.sourceBucketArn,
        });

        const encryptionKey = Key.fromKeyArn(this, 'artifact-bucket-key-arn', props.artifactBucketKeyArn);

        const artifactBucket = Bucket.fromBucketAttributes(this, 'pipeline-artifact-bucket', {
            bucketArn: props.artifactBucketArn,
            encryptionKey,
        });


        // S3 source action - you can reference an existing S3 bucket as well
        const sourceOutput = new Artifact();
        const sourceAction = new cpactions.S3SourceAction({
            actionName: 'S3Source',
            bucket: sourceBucket,
            bucketKey: SOURCE_CODE_KEY,
            output: sourceOutput,
            role: props.actionsRole,
            trigger: cpactions.S3Trigger.NONE,
        });


        // Synthesize stage - running `cdk synth`
        const synthOutput = new Artifact();
        const synthAction = new cpactions.CodeBuildAction({
            actionName: 'Synth',
            role: props.mainRole,
            input: sourceOutput,
            outputs: [synthOutput],
            project: new codebuild.PipelineProject(this, 'synth-outer-pipeline', {
                role: props.actionsRole,
                buildSpec: codebuild.BuildSpec.fromObject({
                    version: '0.2',
                    env: {
                        'exported-variables': ['targetStackName', 'targetStackVersion'],
                    },
                    phases: {
                        install: {
                            commands: [
                                'cat cdk.context.json',
                                'node --version',
                                'npm install -g aws-cdk',
                                'npx aws-cdk --version',
                                'targetStackName=$(jq -r .stackName cdk.context.json)',
                                'targetStackVersion=$(jq -r .version cdk.context.json)',
                                `aws codeartifact login --tool npm --repository ${COMMON_REPO} --domain ${DOMAIN_NAME} --domain-owner ${TargetEnvironments.DEVOPS.account}`,
                                `aws s3 cp s3://${sourceBucket.bucketName}/${SOURCE_CODE_KEY} s3://${sourceBucket.bucketName}/${INNER_PIPELINE_INPUT_FOLDER}/$targetStackName-$targetStackVersion.zip`,
                            ],
                        },
                        build: {
                            commands: ['npm ci', 'npm run build', 'cdk synth  -c pipeline=true'],
                        },
                    },
                    artifacts: {
                        'base-directory': 'cdk.out', // Output directory from cdk synth
                        files: [props.templatePath],
                    },
                }),
                environment: {
                    buildImage: codebuild.LinuxBuildImage.STANDARD_7_0,
                    environmentVariables: getTargetEnvironmentsEnvVariablesAsCodeBuildObject(),
                },
            }),
        });
        const targetStackName = synthAction.variable('targetStackName');
        const targetStackVersion = synthAction.variable('targetStackVersion');

        // Deploy stage
        const deployAction = new cpactions.CloudFormationCreateUpdateStackAction({
            actionName: 'CFN_Deploy',
            templatePath: synthOutput.atPath(props.templatePath),
            stackName: makeVersionedPipelineStackName(targetStackName, targetStackVersion),
            adminPermissions: true,
            role: props.actionsRole,
            cfnCapabilities: [cdk.CfnCapabilities.NAMED_IAM],
        });

        // Create the pipeline
        new codepipeline.Pipeline(this, 'outer-pipeline', {
            pipelineType: PipelineType.V2,
            role: props.mainRole,
            artifactBucket: artifactBucket,
            pipelineName: OUTER_PIPELINE_NAME,
            stages: [
                {
                    stageName: 'Source',
                    actions: [sourceAction],
                },
                {
                    stageName: 'Synth',
                    actions: [synthAction],
                },
                {
                    stageName: 'Deploy',
                    actions: [deployAction],
                },
            ],
        });
    }
}
