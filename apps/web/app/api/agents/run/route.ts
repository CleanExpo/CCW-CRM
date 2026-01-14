import { NextRequest, NextResponse } from 'next/server';
import { run, Agent } from '@openai/agents';

// Lazy import agents to avoid build issues
async function getAgent(agentId: string) {
    switch (agentId) {
        case 'marketing_specialist': {
            const { marketingSpecialist } = await import('@/src/agents/marketing/specialist');
            return marketingSpecialist;
        }
        case 'service_orchestrator': {
            const { serviceOrchestrator } = await import('@/src/agents/service/orchestrator');
            return serviceOrchestrator;
        }
        case 'content_planner': {
            const { contentPlannerAgent } = await import('@/src/agents/creative/planner');
            return contentPlannerAgent;
        }
        case 'media_producer': {
            const { mediaProductionAgent } = await import('@/src/agents/creative/media_producer');
            return mediaProductionAgent;
        }
        default:
            return null;
    }
}

interface RunState {
    runId: string;
    agentId: string;
    status: 'queued' | 'running' | 'completed' | 'error' | 'pending_approval';
    startedAt: string;
    completedAt?: string;
    input: string;
    output?: unknown;
    error?: string;
}

// In-memory store (replace with Redis/DB in production)
const runs: Map<string, RunState> = new Map();

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { agentId, input } = body;

        if (!agentId || !input) {
            return NextResponse.json(
                { error: 'agentId and input are required' },
                { status: 400 }
            );
        }

        const agent = await getAgent(agentId);
        if (!agent) {
            return NextResponse.json(
                { error: `Unknown agent: ${agentId}` },
                { status: 404 }
            );
        }

        const runId = `run-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

        const runState: RunState = {
            runId,
            agentId,
            status: 'queued',
            startedAt: new Date().toISOString(),
            input,
        };

        runs.set(runId, runState);

        // Execute agent asynchronously
        executeAgent(runId, agent, input).catch((error) => {
            console.error(`Agent run ${runId} failed:`, error);
            const r = runs.get(runId);
            if (r) {
                r.status = 'error';
                r.error = error instanceof Error ? error.message : String(error);
                r.completedAt = new Date().toISOString();
            }
        });

        return NextResponse.json(runState, { status: 201 });
    } catch (error) {
        console.error('Failed to start agent run:', error);
        const errorMessage = error instanceof Error ? error.message : String(error);
        const errorStack = error instanceof Error ? error.stack : undefined;
        console.error('Stack:', errorStack);
        return NextResponse.json(
            {
                error: 'Internal server error',
                details: errorMessage,
                stack: process.env.NODE_ENV === 'development' ? errorStack : undefined
            },
            { status: 500 }
        );
    }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function executeAgent(runId: string, agent: Agent<any, any>, input: string) {
    const runState = runs.get(runId);
    if (!runState) return;

    runState.status = 'running';

    try {
        console.log(`[Agent Run ${runId}] Starting ${agent.name}`);
        console.log(`[Agent Run ${runId}] Input: ${input}`);

        const result = await run(agent, input, {
            maxTurns: 10,
        });

        runState.status = 'completed';
        runState.output = result.finalOutput;
        runState.completedAt = new Date().toISOString();

        // Check if output requires approval
        if (typeof result.finalOutput === 'object' && result.finalOutput !== null) {
            const output = result.finalOutput as Record<string, unknown>;
            if (output.requiresApproval) {
                runState.status = 'pending_approval';
            }
        }

        console.log(`[Agent Run ${runId}] Completed`);
    } catch (error) {
        runState.status = 'error';
        runState.error = error instanceof Error ? error.message : String(error);
        runState.completedAt = new Date().toISOString();
        console.error(`[Agent Run ${runId}] Error:`, error);
        throw error;
    }
}

export async function GET(request: NextRequest) {
    const runId = request.nextUrl.searchParams.get('runId');

    if (runId) {
        const runState = runs.get(runId);
        if (!runState) {
            return NextResponse.json({ error: 'Run not found' }, { status: 404 });
        }
        return NextResponse.json(runState);
    }

    // Return recent runs (last 20)
    const allRuns = Array.from(runs.values())
        .sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime())
        .slice(0, 20);

    return NextResponse.json(allRuns);
}
