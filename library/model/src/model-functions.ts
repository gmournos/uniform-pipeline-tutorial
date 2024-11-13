import * as types from './model-types';
import * as specifics from './model-specific';

const getEnvironmentVariableKey = (varName: string) => {
    return `UNIFORM_PIPELINES_ENV_${varName}`;
};

const getEnvironmentVariableValue = (envVariableFullName: string) => {
    const result = process.env[envVariableFullName];
    if (result === undefined) {
        throw new Error(`Missing environment variable ${envVariableFullName}`);
    }
    return result;
};

const getAccountEnvironmentVariableKey = (accountKey: string) => {
    return getEnvironmentVariableKey(`ACCOUNT_${accountKey}`);
};

const getRegionEnvironmentVariableKey = (accountKey: string) => {
    return getEnvironmentVariableKey(`REGION_${accountKey}`);
};

const getAccountEnvironmentVariableValue = (accountKey: string): string => {
    return getEnvironmentVariableValue(getAccountEnvironmentVariableKey(accountKey));
};

const getRegionEnvironmentVariableValue = (accountKey: string): string => {
    return getEnvironmentVariableValue(getRegionEnvironmentVariableKey(accountKey));
};

// Helper function to generate a target environment
const createTargetEnvironment = (environmentName: string) => {
    return {
        account: getAccountEnvironmentVariableValue(environmentName),
        region: getRegionEnvironmentVariableValue(environmentName),
        uniqueName: environmentName.toLowerCase(),
    };
};

// Function to generate TargetEnvironments by looping over the Environment enum
export const generateTargetEnvironments = () : { [key in specifics.EnvironmentName]: types.TargetEnvironment } => {
    return Object.values(specifics.EnvironmentName).reduce((acc, env) => {
        acc[env] = createTargetEnvironment(env);
        return acc;
    }, {} as { [key in specifics.EnvironmentName]: types.TargetEnvironment });
}

