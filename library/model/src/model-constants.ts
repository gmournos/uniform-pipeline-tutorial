
export const LIBRARY_NAMESPACE = 'uniform-pipeline';
export const DOMAIN_NAME = `${LIBRARY_NAMESPACE}-tutorial-artifact-domain`;
export const NPM_REPO = `${LIBRARY_NAMESPACE}-tutorial-npm-repo`;
export const COMMON_REPO = `${LIBRARY_NAMESPACE}-tutorial-common-repo`;

export const INNER_PIPELINE_STACK_TEMPLATE_NAME = `inner-${LIBRARY_NAMESPACE}-stack`;
export const INNER_PIPELINE_INPUT_FOLDER = 'inner-pipeline-input'
export const SOURCE_CODE_BUCKET_NAME = `${LIBRARY_NAMESPACE}-tutorial-sources-bucket`;
export const SOURCE_CODE_KEY = 'deployments/pipeline-input.zip';
export const ARTIFACT_BUCKET_NAME = `${LIBRARY_NAMESPACE}-artifact-bucket`;
export const ARTIFACT_BUCKET_KEY_NAME = `${LIBRARY_NAMESPACE}-artifact-key`;
export const ARTIFACT_BUCKET_KEY_ALIAS = `${LIBRARY_NAMESPACE}-artifact-key-alias`;
export const OUTER_PIPELINE_NAME = 'Uniform_Outer_Pipeline';
export const CHANGESET_RENAME_MACRO = `${LIBRARY_NAMESPACE}-changeset-rename-macro`;
export const ROLE_REASSIGN_MACRO = `${LIBRARY_NAMESPACE}-role-reassign-macro`;
export const ROLE_REASSIGN_MACRO_FUNCTION = `${LIBRARY_NAMESPACE}-role-reassign-macro-function`;
export const CHANGESET_RENAME_MACRO_FUNCTION = `${LIBRARY_NAMESPACE}-changeset-rename-macro-function`;
export const CHANGESET_RENAME_MACRO_ROLE = `${LIBRARY_NAMESPACE}-changeset-rename-macro-function-role`;
export const KMS_ALIAS_FINDER_FUNCTION = `${LIBRARY_NAMESPACE}-kms-alias-finder-function`;

export const PIPELINES_BUILD_SPEC_DEF_FILE = 'custom-buildspec.yaml';
export const PIPELINES_POSTMAN_SPEC_DEF_FILE = 'postman.json';

export const POSTMAN_REPORT_GROUP =  `${LIBRARY_NAMESPACE}-postman-report-group`;


export enum StackExports {
    PIPELINE_SOURCE_BUCKET_ARN_REF = `${LIBRARY_NAMESPACE}-source-bucket-arn-ref`,
    PIPELINE_ARTIFACT_BUCKET_KEY_ARN_REF = `${LIBRARY_NAMESPACE}-artifact-bucket-key-arn-ref`,
    PIPELINE_ARTIFACT_BUCKET_ARN_REF = `${LIBRARY_NAMESPACE}-artifact-bucket-arn-ref`,
    OUTER_PIPELINE_MAIN_ROLE_ARN_REF = `${LIBRARY_NAMESPACE}-outer-main-role-arn-ref`,
    OUTER_PIPELINE_ACTIONS_ROLE_ARN_REF = `${LIBRARY_NAMESPACE}-outer-actions-role-arn-ref`,
    OUTER_PIPELINE_DEPLOYMENT_ROLE_ARN_REF = `${LIBRARY_NAMESPACE}-deploymenent-role-arn-ref`,
    KMS_FINDER_PROVIDER_REF = `${LIBRARY_NAMESPACE}-kms-provider-ref`,
    POSTMAN_REPORT_GROUP_ARN_REF = `${LIBRARY_NAMESPACE}-postman-report-group-arn-ref`,
}

export const STACK_NAME_TAG = `${LIBRARY_NAMESPACE}:contained-stack-name`;
export const STACK_VERSION_TAG = `${LIBRARY_NAMESPACE}:contained-stack-version`;
export const DEPLOYER_STACK_NAME_TAG = `${LIBRARY_NAMESPACE}:deployer-stack-name`;
export const STACK_DEPLOYED_AT_TAG = `${LIBRARY_NAMESPACE}:deployed-at`;

export enum PipelineRoles {
    OUTER_PIPELINE_ROLE = 'outer-pipeline-role',
    OUTER_PIPELINE_ACTIONS_ROLE = 'outer-pipeline-actions-role',
    OUTER_PIPELINE_DEPLOYMENT_ROLE = 'outer-pipeline-deployment-deployment-role',
    KMS_FINDER_FUNCTION_ROLE =`${LIBRARY_NAMESPACE}-kms-finder-role`,
    KMS_FINDER_PROVIDER_ROLE =`${LIBRARY_NAMESPACE}-kms-finder-provider-role`,
    INNER_PIPELINE_MAIN_ROLE = `inner-${LIBRARY_NAMESPACE}-role`,
    INNER_PIPELINE_CODEBUILD_ROLE_SOURCE_STAGE_SOURCE_ACTION = `inner-${LIBRARY_NAMESPACE}-source-role`,
    INNER_PIPELINE_CODEBUILD_ROLE_BUILD_STAGE_BUILD_CDK_ACTION = `inner-${LIBRARY_NAMESPACE}-synth-role`,
    INNER_PIPELINE_CODEBUILD_ROLE_DEPLOY_STAGE_APPROVAL_ACTION = `inner-${LIBRARY_NAMESPACE}-manual-approval-role`,
    INNER_PIPELINE_CODEBUILD_SERVICE_ROLE_SELFUPDATE_PROJECT = `inner-${LIBRARY_NAMESPACE}-self-mutation-role`,
    INNER_PIPELINE_CODEBUILD_SERVICE_ROLE_ASSETS_PROJECT = `inner-${LIBRARY_NAMESPACE}-assets-role`,
    INNER_PIPELINE_CODEBUILD_SERVICE_ROLE_CDK_BUILD_PROJECT = `inner-pipeline-build-service-role`,
    INNER_PIPELINE_CODEBUILD_SERVICE_ROLE_POSTMAN_BUILD_PROJECT = `inner-${LIBRARY_NAMESPACE}-postman-role`,
    // same permissions are needed for these actions as in build stage/synth action
    INNER_PIPELINE_CODEBUILD_ROLE_UPDATEPIPELINE_STAGE_SELFMUTATE_ACTION = INNER_PIPELINE_CODEBUILD_ROLE_BUILD_STAGE_BUILD_CDK_ACTION,
    INNER_PIPELINE_CODEBUILD_ROLE_ASSETS_STAGE_FILEASSET_ACTION = INNER_PIPELINE_CODEBUILD_ROLE_BUILD_STAGE_BUILD_CDK_ACTION,
    INNER_PIPELINE_CODEBUILD_ROLE_DEPLOY_STAGE_POSTMAN_ACTION = INNER_PIPELINE_CODEBUILD_ROLE_BUILD_STAGE_BUILD_CDK_ACTION, 
};

