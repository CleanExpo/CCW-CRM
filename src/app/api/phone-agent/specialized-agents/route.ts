import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { requireAuthScope } from '@/lib/auth/data-scope';
import {
  ccwWorkspaceRecordOwnerId,
  resolveCcwWorkspaceContext,
} from '@/lib/auth/ccw-workspace-context';
import { getWorkspaceMemberUserIds } from '@/lib/auth/workspace-scope';
import { defaultCcwSpecializedAgent } from '@/lib/phone-agent/conversation-intelligence';

const DEFAULT_AGENT_CODES = [
  'front-desk-agent',
  'lead-capture-agent',
  'online-sales-agent',
  'orders-agent',
  'service-booking-agent',
  'carsi-training-agent',
  'campaign-agent',
  'industry-events-agent',
];

function text(value: unknown, fallback = '') {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

function agentRow(row: {
  id: string;
  agentCode: string;
  name: string;
  purpose: string;
  persona: unknown;
  playbook: unknown;
  status: string;
  requiresApproval: boolean;
  approvedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  _count?: { learningItems: number; followUpRules: number };
}) {
  return {
    id: row.id,
    agent_code: row.agentCode,
    name: row.name,
    purpose: row.purpose,
    persona: row.persona,
    playbook: row.playbook,
    status: row.status,
    requires_approval: row.requiresApproval,
    approved_at: row.approvedAt?.toISOString() ?? null,
    counts: {
      learning_items: row._count?.learningItems ?? 0,
      follow_up_rules: row._count?.followUpRules ?? 0,
    },
    created_at: row.createdAt.toISOString(),
    updated_at: row.updatedAt.toISOString(),
  };
}

export async function GET(request: NextRequest) {
  try {
    const scope = await requireAuthScope(request);
    if (!scope) return NextResponse.json({ detail: 'Not authenticated' }, { status: 401 });

    const workspaceUserIds = await getWorkspaceMemberUserIds(scope.userId);
    const rows = await prisma.ccwSpecializedAgent.findMany({
      where: { ownerUserId: { in: workspaceUserIds } },
      include: { _count: { select: { learningItems: true, followUpRules: true } } },
      orderBy: [{ status: 'asc' }, { updatedAt: 'desc' }],
    });

    return NextResponse.json({ items: rows.map(agentRow), total: rows.length });
  } catch (e) {
    return NextResponse.json({ detail: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const scope = await requireAuthScope(request);
    if (!scope) return NextResponse.json({ detail: 'Not authenticated' }, { status: 401 });

    const ctx = await resolveCcwWorkspaceContext(scope.userId);
    if (!ctx) return NextResponse.json({ detail: 'No workspace found for this user' }, { status: 403 });

    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const seedDefaults = body.seed_defaults === true;
    const codes = seedDefaults ? DEFAULT_AGENT_CODES : [text(body.agent_code)];
    const created = [];
    const workspaceOwnerUserId = ccwWorkspaceRecordOwnerId(ctx);

    for (const code of codes.filter(Boolean)) {
      const seed = defaultCcwSpecializedAgent(code);
      const row = await prisma.ccwSpecializedAgent.upsert({
        where: {
          ownerUserId_agentCode: { ownerUserId: workspaceOwnerUserId, agentCode: seed.agent_code },
        },
        create: {
          ownerUserId: workspaceOwnerUserId,
          agentCode: seed.agent_code,
          name: text(body.name, seed.name),
          purpose: text(body.purpose, seed.purpose),
          persona: seed.persona,
          playbook: seed.playbook,
          status: text(body.status, 'draft'),
          requiresApproval: true,
        },
        update: {
          name: text(body.name, seed.name),
          purpose: text(body.purpose, seed.purpose),
          persona: seed.persona,
          playbook: seed.playbook,
          requiresApproval: true,
        },
        include: { _count: { select: { learningItems: true, followUpRules: true } } },
      });
      created.push(agentRow(row));
    }

    if (created.length === 0) {
      return NextResponse.json({ detail: 'agent_code or seed_defaults is required' }, { status: 400 });
    }

    return NextResponse.json({ items: created, total: created.length }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ detail: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
