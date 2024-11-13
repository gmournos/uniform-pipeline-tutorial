
export type TargetEnvironment = {
    account: string;
    region: string;
    uniqueName: string;
};

export type TargetEnvironmentsType = { [key: string]: TargetEnvironment; };