import { Duration } from 'aws-cdk-lib';
import { LoggingFormat, Runtime } from 'aws-cdk-lib/aws-lambda';
import { NodejsFunction, NodejsFunctionProps } from 'aws-cdk-lib/aws-lambda-nodejs';
import { RetentionDays } from 'aws-cdk-lib/aws-logs';
import { Construct } from 'constructs';

const getRetentionDaysFromContext = (scope: Construct) => {
    const retentionDaysContext = scope.node.tryGetContext('retentionDays');
    const retentionDays = Number.parseInt(retentionDaysContext ?? 365); // default one year
    return retentionDays as RetentionDays;
}

export class HighLevelFunction extends NodejsFunction {
    constructor(scope: Construct, id: string, props?: NodejsFunctionProps) {
        super(scope, id, {
            ...props,
            
            // fixed and environment independent
            loggingFormat: props?.loggingFormat ?? LoggingFormat.JSON,
            timeout: props?.timeout ?? Duration.seconds(30),
            runtime: props?.runtime ?? Runtime.NODEJS_LATEST,

            // variable e.g. environment dependent
            logRetention: props?.logRetention ?? getRetentionDaysFromContext(scope),
        });
    }
}