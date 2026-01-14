/**
 * Creative Skills - Autonomous Content Generation Skills
 * Scheduling and cadence management for the Creative Suite
 */

import { tool } from '@openai/agents';
import { z } from 'zod';

// Cadence trigger configuration stored in memory (replace with DB in production)
interface CadenceTrigger {
    id: string;
    frequency: 'Weekly' | 'Monthly' | 'Quarterly' | 'Yearly';
    startDate: string;
    nextTriggerDate: string;
    actionType: 'ContentCalendar' | 'AssetGeneration' | 'ApprovalRequest' | 'Report';
    payload: Record<string, unknown>;
    isActive: boolean;
    createdAt: string;
    lastTriggeredAt?: string;
}

const cadenceTriggers: Map<string, CadenceTrigger> = new Map();

/**
 * Calculate the next trigger date based on frequency
 */
function calculateNextTrigger(currentDate: Date, frequency: CadenceTrigger['frequency']): Date {
    const next = new Date(currentDate);

    switch (frequency) {
        case 'Weekly':
            next.setDate(next.getDate() + 7);
            break;
        case 'Monthly':
            next.setMonth(next.getMonth() + 1);
            break;
        case 'Quarterly':
            next.setMonth(next.getMonth() + 3);
            break;
        case 'Yearly':
            next.setFullYear(next.getFullYear() + 1);
            break;
    }

    return next;
}

/**
 * Schedule Cadence Trigger Skill
 * Sets up recurring content generation triggers
 */
export const scheduleCadenceTriggerTool = tool({
    name: 'schedule_cadence_trigger',
    description: 'Schedule a recurring trigger for automated content generation based on cadence (Weekly, Monthly, Quarterly, Yearly)',
    parameters: z.object({
        frequency: z.enum(['Weekly', 'Monthly', 'Quarterly', 'Yearly']).describe('How often the trigger should fire'),
        startDate: z.string().describe('When to start the cadence (ISO date format)'),
        actionType: z.enum(['ContentCalendar', 'AssetGeneration', 'ApprovalRequest', 'Report']).describe('What action to trigger'),
        payload: z.record(z.unknown()).optional().describe('Additional data to pass to the triggered action'),
    }),
    execute: async ({ frequency, startDate, actionType, payload }) => {
        const triggerId = `trigger-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        const start = new Date(startDate);

        const trigger: CadenceTrigger = {
            id: triggerId,
            frequency,
            startDate,
            nextTriggerDate: start.toISOString(),
            actionType,
            payload: payload || {},
            isActive: true,
            createdAt: new Date().toISOString(),
        };

        cadenceTriggers.set(triggerId, trigger);

        return {
            success: true,
            triggerId,
            message: `Cadence trigger scheduled: ${frequency} ${actionType}`,
            nextTrigger: trigger.nextTriggerDate,
            summary: {
                frequency,
                actionType,
                startDate,
                isActive: true,
            },
        };
    },
});

/**
 * Generate Visual Asset Skill (wrapper for Media Production Agent)
 */
export const generateVisualAssetTool = tool({
    name: 'generate_visual_asset',
    description: 'Generate a visual asset (Image, Video, or SVG Infographic) using the appropriate AI model',
    parameters: z.object({
        asset_type: z.enum(['Image', 'Video', 'SVG_Infographic']).describe('Type of asset to generate'),
        dimension: z.string().describe('Dimensions of the asset (e.g., "1920x1080")'),
        prompt_xml: z.string().describe('XML-tagged instructions for the asset generation'),
    }),
    execute: async ({ asset_type, dimension, prompt_xml }) => {
        // This skill delegates to the Media Production Agent
        // In production, this would queue the request properly

        const jobId = `asset-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

        return {
            success: true,
            jobId,
            message: `Asset generation queued: ${asset_type}`,
            requiresHumanApproval: true,
            approvalReason: 'Visual assets require review before publishing',
            assetDetails: {
                type: asset_type,
                dimension,
                promptPreview: prompt_xml.substring(0, 100) + '...',
            },
        };
    },
});

/**
 * Check for due triggers and return actions to execute
 */
export function processDueTriggers(): CadenceTrigger[] {
    const now = new Date();
    const dueTriggers: CadenceTrigger[] = [];

    for (const [id, trigger] of cadenceTriggers) {
        if (!trigger.isActive) continue;

        const triggerDate = new Date(trigger.nextTriggerDate);

        if (triggerDate <= now) {
            dueTriggers.push(trigger);

            // Update to next trigger date
            trigger.lastTriggeredAt = now.toISOString();
            trigger.nextTriggerDate = calculateNextTrigger(now, trigger.frequency).toISOString();
            cadenceTriggers.set(id, trigger);
        }
    }

    return dueTriggers;
}

/**
 * Get all active triggers
 */
export function getActiveTriggers(): CadenceTrigger[] {
    return Array.from(cadenceTriggers.values()).filter(t => t.isActive);
}

/**
 * Deactivate a trigger
 */
export function deactivateTrigger(triggerId: string): boolean {
    const trigger = cadenceTriggers.get(triggerId);
    if (trigger) {
        trigger.isActive = false;
        cadenceTriggers.set(triggerId, trigger);
        return true;
    }
    return false;
}

/**
 * Format trigger for display
 */
export function formatTriggerSummary(trigger: CadenceTrigger): string {
    return `[${trigger.frequency}] ${trigger.actionType} - Next: ${new Date(trigger.nextTriggerDate).toLocaleDateString()}`;
}

export type { CadenceTrigger };
