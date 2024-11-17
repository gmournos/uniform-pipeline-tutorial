import { BuildSpec, LinuxBuildImage, ReportGroupType } from "aws-cdk-lib/aws-codebuild";
import { CodeBuildStepProps, CodePipelineSource } from "aws-cdk-lib/pipelines";
import { COMMON_REPO, DOMAIN_NAME, getTargetEnvironmentsEnvVariablesAsObject, PIPELINES_BUILD_SPEC_DEF_FILE, PIPELINES_BUILD_SPEC_POSTMAN_DEF_FILE, 
    PIPELINES_POSTMAN_SPEC_DEF_FILE, StackExports, TargetEnvironment, TargetEnvironments } from "@uniform-pipelines/model";
import { Fn } from "aws-cdk-lib";
import * as fs from 'fs';
import * as yaml from 'js-yaml';
import { CfnPipeline } from "aws-cdk-lib/aws-codepipeline";


export const fileExists = (filename: string) => {
    try {
        fs.accessSync(filename);
        return true;
    } catch (err) {
        return false;
    }
};

export const hasBuildSpec = () => {
    return fileExists(PIPELINES_BUILD_SPEC_DEF_FILE);
};

export const hasPostmanSpec = () => {
    return fileExists(PIPELINES_POSTMAN_SPEC_DEF_FILE);
};

export const hasPostmanBuildSpec = () => {
    return fileExists(PIPELINES_BUILD_SPEC_POSTMAN_DEF_FILE);
};


export const makeMainBuildStepDefaultBuildspec = (codeSource: CodePipelineSource)  => {
    return {
        buildEnvironment: {
            buildImage: LinuxBuildImage.STANDARD_7_0,
        },
        input: codeSource,
        installCommands: [
            'npm install -g aws-cdk',
            `aws codeartifact login --tool npm --repository ${COMMON_REPO} --domain ${DOMAIN_NAME} --domain-owner ${TargetEnvironments.DEVOPS.account}`,
        ],
        commands: ['npm ci', 'npm run build', 'npx aws-cdk synth -c pipeline=true'], // Build and synthesize the CDK app
        env: getTargetEnvironmentsEnvVariablesAsObject(),
    };
};

export const makePostmanCodeBuildDefaultBuildspec = (targetEnvironment: TargetEnvironment, codeSource: CodePipelineSource) => {

    const testReportsArn = Fn.importValue(StackExports.POSTMAN_REPORT_GROUP_ARN_REF);

    const defaultBuildSpecProps: CodeBuildStepProps = {
        buildEnvironment: {
            buildImage: LinuxBuildImage.STANDARD_7_0,
        },
        input: codeSource,
        installCommands: [
            `aws codeartifact login --tool npm --repository ${COMMON_REPO} --domain ${DOMAIN_NAME} --domain-owner ${TargetEnvironments.DEVOPS.account}`,
            'npm install -g newman',
        ],
        commands: [
            `echo "Running API tests at ${targetEnvironment.uniqueName}"`,
            `newman run -r junit ${PIPELINES_POSTMAN_SPEC_DEF_FILE}`,
        ],
        partialBuildSpec: BuildSpec.fromObject({

            reports: {
                [testReportsArn]: {
                    files: ['**/*'],
                    'base-directory': 'newman',
                    'discard-paths': true,
                    type: ReportGroupType.TEST,
                },
            },
        }),
    };
    return defaultBuildSpecProps;
};

export const disableTransitions = (pipeline: CfnPipeline, stageNames: string[], disableReason: string) => {
    const disableTransitionsPropertyParams = stageNames.map(stageName => {
        return {
            Reason: disableReason,
            StageName: stageName,
        };
    });
    pipeline.addPropertyOverride("DisableInboundStageTransitions", disableTransitionsPropertyParams);
};

export const overrideBuildSpecPropsFromBuildspecYamlFile = (defaultBuildSpecProps: CodeBuildStepProps, buildspecFilename: string) => {
    const overridingObject = yaml.load(fs.readFileSync(buildspecFilename, 'utf8')) as Record<string, any>;

    const buildSpecProps = { ...defaultBuildSpecProps } as any;

    const installCommands = overridingObject.phases?.install?.commands;
    if (installCommands) {
        buildSpecProps.installCommands = installCommands;
        delete overridingObject.phases.install.commands;
    }
    const buildCommands = overridingObject.phases?.build?.commands;
    if (buildCommands) {
        buildSpecProps.commands = buildCommands;
        delete overridingObject.phases?.build.commands;
    }

    const baseDirectory = overridingObject.artifacts?.['base-directory'];
    if (baseDirectory) {
        buildSpecProps.baseDirectory = baseDirectory;
        delete overridingObject.artifacts['base-directory'];
    }

    const buildImage = overridingObject['build-image'] as string;
    if (buildImage && LinuxBuildImage[buildImage as keyof typeof LinuxBuildImage]) {
        buildSpecProps.buildEnvironment.buildImage = LinuxBuildImage[buildImage as keyof typeof LinuxBuildImage];
    }

    buildSpecProps.partialBuildSpec = BuildSpec.fromObject(overridingObject);
    return buildSpecProps;
};
