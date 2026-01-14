/**
 * CCW Agent Runtime with Human-in-the-Loop (HITL) Support
 * 
 * This module manages the multi-agent execution loop with safety gates.
 * When an agent requests approval, execution pauses and state is persisted.
 */

import { run, Agent } from '@openai/agents';
import * as fs from 'fs';
import * as path from 'path';

// Approval state persistence path
const PENDING_APPROVALS_PATH = path.join(process.cwd(), 'src/state/pending_approvals.json');

/**
 * Pending Approval Structure
 */
export interface PendingApproval {
    id: string;
    agentName: string;
    toolName: string;
    content: unknown;
    rationale: string;
    createdAt: string;
    status: 'pending' | 'approved' | 'rejected';
    interruptionMessage: string;
}

/**
 * Agent Runtime State
 */
interface RuntimeState {
    pendingApprovals: PendingApproval[];
    lastUpdated: string;
}

/**
 * Load pending approvals from disk
 */
export function loadPendingApprovals(): RuntimeState {
    try {
        if (fs.existsSync(PENDING_APPROVALS_PATH)) {
            const data = fs.readFileSync(PENDING_APPROVALS_PATH, 'utf-8');
            return JSON.parse(data);
        }
    } catch (error) {
        console.error('[Runtime] Failed to load approvals:', error);
    }
    return { pendingApprovals: [], lastUpdated: new Date().toISOString() };
}

/**
 * Save pending approvals to disk
 */
export function savePendingApprovals(state: RuntimeState): void {
    try {
        const dir = path.dirname(PENDING_APPROVALS_PATH);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        fs.writeFileSync(PENDING_APPROVALS_PATH, JSON.stringify(state, null, 2));
    } catch (error) {
        console.error('[Runtime] Failed to save approvals:', error);
    }
}

/**
 * Request human approval - pauses execution
 */
export function requestApproval(
    agentName: string,
    toolName: string,
    content: unknown,
    rationale: string,
    interruptionMessage: string
): PendingApproval {
    const approval: PendingApproval = {
        id: `APPROVAL-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        agentName,
        toolName,
        content,
        rationale,
        createdAt: new Date().toISOString(),
        status: 'pending',
        interruptionMessage,
    };

    const state = loadPendingApprovals();
    state.pendingApprovals.push(approval);
    state.lastUpdated = new Date().toISOString();
    savePendingApprovals(state);

    console.log('\n' + '='.repeat(60));
    console.log('[HITL] APPROVAL REQUIRED');
    console.log('='.repeat(60));
    console.log(`Agent: ${agentName}`);
    console.log(`Tool: ${toolName}`);
    console.log(`Message: ${interruptionMessage}`);
    console.log(`Approval ID: ${approval.id}`);
    console.log('='.repeat(60) + '\n');

    return approval;
}

/**
 * Approve a pending request
 */
export function approveRequest(approvalId: string): boolean {
    const state = loadPendingApprovals();
    const approval = state.pendingApprovals.find((a) => a.id === approvalId);

    if (approval && approval.status === 'pending') {
        approval.status = 'approved';
        state.lastUpdated = new Date().toISOString();
        savePendingApprovals(state);
        console.log(`[HITL] Approved: ${approvalId}`);
        return true;
    }
    return false;
}

/**
 * Reject a pending request
 */
export function rejectRequest(approvalId: string): boolean {
    const state = loadPendingApprovals();
    const approval = state.pendingApprovals.find((a) => a.id === approvalId);

    if (approval && approval.status === 'pending') {
        approval.status = 'rejected';
        state.lastUpdated = new Date().toISOString();
        savePendingApprovals(state);
        console.log(`[HITL] Rejected: ${approvalId}`);
        return true;
    }
    return false;
}

/**
 * Get all pending approvals
 */
export function getPendingApprovals(): PendingApproval[] {
    return loadPendingApprovals().pendingApprovals.filter(
        (a) => a.status === 'pending'
    );
}

/**
 * Multi-Agent Handoff Runner
 * Executes the CCW agent workflow with HITL gates
 */
export async function runAgentWorkflow(
    agent: Agent<unknown, unknown>,
    input: string,
    options?: { maxIterations?: number }
): Promise<{ success: boolean; output?: unknown; pendingApproval?: PendingApproval }> {
    const maxIterations = options?.maxIterations || 10;

    console.log(`[Runtime] Starting agent: ${agent.name}`);
    console.log(`[Runtime] Input: ${input}`);

    try {
        // Run the agent
        const result = await run(agent, input, {
            maxTurns: maxIterations,
        });

        // Check if result contains approval request
        const output = result.finalOutput;
        if (typeof output === 'object' && output !== null && 'requiresApproval' in output) {
            const approvalData = output as { requiresApproval: boolean; approvalRequest?: string };
            if (approvalData.requiresApproval) {
                const pending = requestApproval(
                    agent.name,
                    'generate_campaign_draft',
                    output,
                    'Campaign content generated and ready for review',
                    `Marketing Agent requires review for campaign. Approve publication?`
                );
                return { success: true, pendingApproval: pending };
            }
        }

        return { success: true, output };
    } catch (error) {
        console.error('[Runtime] Agent execution failed:', error);
        return { success: false };
    }
}

export default {
    loadPendingApprovals,
    savePendingApprovals,
    requestApproval,
    approveRequest,
    rejectRequest,
    getPendingApprovals,
    runAgentWorkflow,
};
