import { NextResponse } from 'next/server';
import * as fs from 'fs';
import * as path from 'path';

const PENDING_APPROVALS_PATH = path.join(process.cwd(), 'src/state/pending_approvals.json');

function loadApprovals() {
    try {
        if (fs.existsSync(PENDING_APPROVALS_PATH)) {
            const data = fs.readFileSync(PENDING_APPROVALS_PATH, 'utf-8');
            return JSON.parse(data);
        }
    } catch (error) {
        console.error('Failed to load approvals:', error);
    }
    return { pendingApprovals: [], lastUpdated: new Date().toISOString() };
}

export async function GET() {
    const state = loadApprovals();
    return NextResponse.json(state);
}
