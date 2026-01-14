import { tool } from '@openai/agents';
import { z } from 'zod';

/**
 * Notify Customer Tool
 * Sends notifications to customers about their service jobs.
 */
export const notifyCustomer = tool({
    name: 'notify_customer',
    description: 'Sends notifications to customers about their service jobs via email or SMS.',
    parameters: z.object({
        customerId: z.string().describe('The customer ID'),
        jobId: z.string().describe('The related service job ID'),
        channel: z.enum(['email', 'sms', 'both']).describe('Notification channel'),
        message: z.string().describe('The notification message'),
        templateId: z.string().optional().describe('Optional template ID to use'),
    }),
    execute: async ({ customerId, jobId, channel, message, templateId }) => {
        console.log(`[Notify] Customer: ${customerId}, Channel: ${channel}`);

        // TODO: Connect to notification service (SendGrid, Twilio, etc.)
        return {
            success: true,
            customerId,
            jobId,
            channel,
            messagePreview: message.substring(0, 50) + '...',
            sentAt: new Date().toISOString(),
        };
    },
});

export default notifyCustomer;
