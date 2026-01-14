import { tool } from '@openai/agents';
import { z } from 'zod';

/**
 * Update Kanban Stage Tool
 * Updates the stage of a service job in the Kanban board.
 */
export const updateKanbanStage = tool({
    name: 'update_kanban_stage',
    description: 'Updates the stage of a service job in the Kanban board.',
    parameters: z.object({
        jobId: z.string().describe('The service job ID'),
        stage: z.enum([
            'received',
            'diagnosed',
            'parts_ordered',
            'in_progress',
            'completed',
        ]).describe('The new stage for the job'),
        notes: z.string().optional().describe('Optional notes about the stage change'),
    }),
    execute: async ({ jobId, stage, notes }) => {
        console.log(`[Kanban Update] Job: ${jobId} → Stage: ${stage}`);

        // TODO: Connect to actual Kanban/database system
        return {
            success: true,
            jobId,
            previousStage: 'unknown',
            newStage: stage,
            notes,
            updatedAt: new Date().toISOString(),
        };
    },
});

export default updateKanbanStage;
