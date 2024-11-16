import { Construct } from 'constructs';
import { CfnMacro, Duration } from 'aws-cdk-lib';
import { join } from 'path';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import { Runtime } from 'aws-cdk-lib/aws-lambda';
import { CHANGESET_RENAME_MACRO, CHANGESET_RENAME_MACRO_FUNCTION, CHANGESET_RENAME_MACRO_ROLE,
    getTargetEnvironmentsEnvVariablesAsObject, ROLE_REASSIGN_MACRO, ROLE_REASSIGN_MACRO_FUNCTION } from '@uniform-pipelines/model';
import { ManagedPolicy, Role, ServicePrincipal } from 'aws-cdk-lib/aws-iam';

export class PipelineMacrosConstruct extends Construct {
    constructor(scope: Construct, id: string) {
        super(scope, id);

        const lambdaRole = new Role(this, CHANGESET_RENAME_MACRO_ROLE, {
            roleName: CHANGESET_RENAME_MACRO_ROLE,
            assumedBy: new ServicePrincipal('lambda.amazonaws.com'), // Lambda service principal
            description: 'Role with basic execution permissions for Lambda',
        });

        // Attach AWSLambdaBasicExecutionRole managed policy to the role
        lambdaRole.addManagedPolicy(ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole'));

        const changesetTransformerMacroFunction = new NodejsFunction(
            this, CHANGESET_RENAME_MACRO_FUNCTION, {
                functionName: CHANGESET_RENAME_MACRO_FUNCTION,
                runtime: Runtime.NODEJS_20_X,
                handler: 'alterChangesetNames',
                entry: join('lambda', 'cloudformation', 'rename-changesets-macro.ts'),
                timeout: Duration.minutes(3),
                role: lambdaRole,
            },
        );

        new CfnMacro(this, CHANGESET_RENAME_MACRO, {
            description: 'Macro that processes Uniform Pipelines and assigns unique changeset names',
            name: CHANGESET_RENAME_MACRO,
            functionName: changesetTransformerMacroFunction.functionName,
        });
        
        const roleTransformerMacroFunction = new NodejsFunction(
            this, ROLE_REASSIGN_MACRO_FUNCTION, {
                functionName: ROLE_REASSIGN_MACRO_FUNCTION,
                runtime: Runtime.NODEJS_20_X,
                handler: 'transformRoles',
                entry: join('lambda', 'cloudformation', 'inner-pipeline-role-transformer.ts'),
                timeout: Duration.minutes(3),
                role: lambdaRole,
                environment: getTargetEnvironmentsEnvVariablesAsObject(),
            },
        );

        new CfnMacro(this, ROLE_REASSIGN_MACRO, {
            description: 'Macro that processes Uniform Pipelines and reassigns to fixed roles and deletes the extra roles and policies',
            name: ROLE_REASSIGN_MACRO,
            functionName: roleTransformerMacroFunction.functionName,
        });
    }
}
