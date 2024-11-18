import { CLEANUP_DELETE_BATCH_SIZE, PipelineStackPair, ProgressStatus } from '@uniform-pipelines/model';
import { deleteCloudFormationStack } from './utils';

export const batchDeleteStacks = async (event: ProgressStatus<PipelineStackPair>) : Promise<ProgressStatus<PipelineStackPair>> => {

    const stacksToDelete = event.unitsOfWork;
    const stacksToProcess = stacksToDelete.slice(0, CLEANUP_DELETE_BATCH_SIZE);
    const remainingStacks = stacksToDelete.slice(CLEANUP_DELETE_BATCH_SIZE);

    for (const stackPipelinePair of stacksToProcess) {
        try {
            console.info(`Attempting to delete stack: ${stackPipelinePair.stackName}...`);
            await deleteCloudFormationStack(stackPipelinePair.stackName);
        } catch (error) {
            console.error(`Failed to delete stack ${stackPipelinePair.stackName}:`, error);
        }
    }

    return {
        isComplete: remainingStacks.length === 0, 
        unitsOfWork: remainingStacks,
    }
};
