import * as cdk from 'aws-cdk-lib';
import * as codepipeline from 'aws-cdk-lib/aws-codepipeline';
import * as cpactions from 'aws-cdk-lib/aws-codepipeline-actions';
import * as codebuild from 'aws-cdk-lib/aws-codebuild';
import { Action, Artifact, PipelineType } from 'aws-cdk-lib/aws-codepipeline';
import { Construct } from 'constructs';
import { COMMON_REPO, DOMAIN_NAME, OUTER_PIPELINE_NAME, TargetEnvironments } from '../../library/model/dist';
import { IRole } from 'aws-cdk-lib/aws-iam';
import { IBucket } from 'aws-cdk-lib/aws-s3';

interface OuterLevelPipelineStackProps {
    sourceAction: Action;
    sourceOutput: Artifact;
    innerPipelineStackName: string;
    templatePath: string;
    mainRole: IRole;
    actionsRole: IRole;
    artifactBucket: IBucket;
}

export class OuterLevelPipelineConstruct extends Construct {
    constructor(scope: cdk.App, id: string, props: OuterLevelPipelineStackProps) {
        super(scope, id);

        // Synthesize stage - running `cdk synth`
        const synthOutput = new Artifact();
        const synthAction = new cpactions.CodeBuildAction({
            actionName: 'Synth',
            role: props.mainRole,
            input: props.sourceOutput,
            outputs: [synthOutput],
            project: new codebuild.PipelineProject(this, 'synth-outer-pipeline', {
                role: props.actionsRole,
                buildSpec: codebuild.BuildSpec.fromObject({
                    version: '0.2',
                    phases: {
                        install: {
                            commands: [
                                'npm install -g aws-cdk',
                                `aws codeartifact login --tool npm --repository ${COMMON_REPO} --domain ${DOMAIN_NAME} --domain-owner ${TargetEnvironments.DEVOPS.account}`,
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
                },
            }),
        });

        // Deploy stage
        const deployAction = new cpactions.CloudFormationCreateUpdateStackAction({
            actionName: 'CFN_Deploy',
            templatePath: synthOutput.atPath(props.templatePath),
            stackName: props.innerPipelineStackName,
            adminPermissions: true,
            role: props.actionsRole,
            cfnCapabilities: [cdk.CfnCapabilities.NAMED_IAM],
        });

        // Create the pipeline
        new codepipeline.Pipeline(this, 'outer-pipeline', {
            pipelineType: PipelineType.V2,
            role: props.mainRole,
            artifactBucket: props.artifactBucket,
            pipelineName: OUTER_PIPELINE_NAME,
            stages: [
                {
                    stageName: 'Source',
                    actions: [props.sourceAction],
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
