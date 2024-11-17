import { IndividualDeploymentPlanProps } from "./model-types";

export enum EnvironmentName {
    DEVOPS = 'DEVOPS',
    DEVELOPMENT = 'DEVELOPMENT',
    TEST = 'TEST',
    ACCEPTANCE = 'ACCEPTANCE',
    PRODUCTION = 'PRODUCTION',
}

export const DeploymentPlan: IndividualDeploymentPlanProps[] = [
    { targetEnvironmentKey: EnvironmentName.TEST, requiresApproval: false, shouldSmokeTest: true },
    { targetEnvironmentKey: EnvironmentName.ACCEPTANCE, requiresApproval: true, shouldSmokeTest: true },
    { targetEnvironmentKey: EnvironmentName.PRODUCTION, requiresApproval: true, shouldSmokeTest: false },
];

export const AscpectContextVars: Record<string, Record<string,any>> ={
    GLOBAL: { logRetention: 365},
    TEST: { logRetetion: 30},
    ACCEPTANCE : { logRetention: 90},
}