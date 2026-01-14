import { tool } from '@openai/agents';
import { z } from 'zod';

/**
 * Generate Service Report Tool
 * Generates a service report for a completed or in-progress job.
 */
export const generateServiceReport = tool({
    name: 'generate_service_report',
    description: 'Generates a service report for a completed or in-progress job.',
    parameters: z.object({
        jobId: z.string().describe('The service job ID'),
        includePhotos: z.boolean().optional().describe('Whether to include photos'),
        format: z.enum(['pdf', 'email', 'json']).optional().describe('Output format'),
    }),
    execute: async ({ jobId, includePhotos, format = 'pdf' }) => {
        console.log(`[Report Gen] Job: ${jobId}, Format: ${format}`);

        // TODO: Connect to report generation service
        return {
            success: true,
            jobId,
            reportUrl: `/reports/${jobId}.${format}`,
            format,
            includePhotos: includePhotos ?? false,
            generatedAt: new Date().toISOString(),
        };
    },
});

export default generateServiceReport;
