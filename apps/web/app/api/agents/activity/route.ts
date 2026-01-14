import { NextResponse } from 'next/server';

// Activity log for agent runs
interface ActivityEntry {
    id: string;
    timestamp: string;
    agentName: string;
    action: string;
    details?: string;
    status: 'info' | 'success' | 'warning' | 'error';
}

// In-memory activity log
const activityLog: ActivityEntry[] = [];

export function logActivity(
    agentName: string,
    action: string,
    details?: string,
    status: 'info' | 'success' | 'warning' | 'error' = 'info'
) {
    const entry: ActivityEntry = {
        id: `act-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
        timestamp: new Date().toISOString(),
        agentName,
        action,
        details,
        status,
    };
    activityLog.unshift(entry);

    // Keep only last 100 entries
    if (activityLog.length > 100) {
        activityLog.pop();
    }

    return entry;
}

export async function GET() {
    return NextResponse.json(activityLog.slice(0, 50));
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { agentName, action, details, status } = body;

        if (!agentName || !action) {
            return NextResponse.json(
                { error: 'agentName and action are required' },
                { status: 400 }
            );
        }

        const entry = logActivity(agentName, action, details, status);
        return NextResponse.json(entry, { status: 201 });
    } catch (error) {
        console.error('Failed to log activity:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
