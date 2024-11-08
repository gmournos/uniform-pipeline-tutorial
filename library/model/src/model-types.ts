
export type TargetEnvironment = {
    account: string;
    region: string;
    uniqueName: string;
};

export type TargetEnvironmentsType = { [key: string]: TargetEnvironment; };

export interface IndividualDeploymentPlanProps {
    requiresApproval: boolean, 
    shouldSmokeTest: boolean,
    targetEnvironmentKey: string;
}

export type DeploymentPlanType = { [key: string]: IndividualDeploymentPlanProps; };


export interface PipelineStackPair {
    pipelineName: string,
    stackName: string,
}

export interface ProgressStatus<T> {
    isComplete: boolean;
    unitsOfWork: T[];
}

