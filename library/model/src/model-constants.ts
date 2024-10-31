
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

export enum StackExports {
    PIPELINE_SOURCE_BUCKET_ARN_REF = `${LIBRARY_NAMESPACE}-source-bucket-arn-ref`,
    PIPELINE_ARTIFACT_BUCKET_KEY_ARN_REF = `${LIBRARY_NAMESPACE}-artifact-bucket-key-arn-ref`,
    PIPELINE_ARTIFACT_BUCKET_ARN_REF = `${LIBRARY_NAMESPACE}-artifact-bucket-arn-ref`,
}

export const STACK_NAME_TAG = `${LIBRARY_NAMESPACE}:contained-stack-name`;
export const STACK_VERSION_TAG = `${LIBRARY_NAMESPACE}:contained-stack-version`;
export const DEPLOYER_STACK_NAME_TAG = `${LIBRARY_NAMESPACE}:deployer-stack-name`;
export const STACK_DEPLOYED_AT_TAG = `${LIBRARY_NAMESPACE}:deployed-at`;

