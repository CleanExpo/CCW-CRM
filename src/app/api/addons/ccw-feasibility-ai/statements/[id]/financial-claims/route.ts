import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { requireAuthScope } from '@/lib/auth/data-scope';
import { getWorkspaceMemberUserIds } from '@/lib/auth/workspace-scope';

type Params = { params: Promise<{ id: string }> };

const CLAIM_STATES = new Set(['owner_entered', 'toby_adjusted', 'xero_backed', 'stale', 'disputed']);

function text(value: unknown, fallback = '') {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

function numberOrNull(value: unknown) {
  const next = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN;
  return Number.isFinite(next) ? next : null;
}

export async function POST(request: NextRequest, { params }: Params) {
  try {
    const scope = await requireAuthScope(request);
    if (!scope) return NextResponse.json({ detail: 'Not authenticated' }, { status: 401 });

    const { id } = await params;
    const workspaceUserIds = await getWorkspaceMemberUserIds(scope.userId);
    const statement = await prisma.ccwFeasibilityStatement.findFirst({
      where: { id, ownerUserId: { in: workspaceUserIds } },
      select: { id: true },
    });
    if (!statement) return NextResponse.json({ detail: 'Statement not found' }, { status: 404 });

    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const label = text(body.label);
    if (!label) return NextResponse.json({ detail: 'label is required' }, { status: 400 });

    const claimType = text(body.claim_type, 'operating_cost');
    const state = CLAIM_STATES.has(text(body.state)) ? text(body.state) : 'owner_entered';
    const sourceSystem = text(body.source_system, state === 'xero_backed' ? 'xero' : 'manual');
    const valueAud = numberOrNull(body.value_aud);
    const sourceReference = text(body.source_reference);
    const sourceUrl = text(body.source_url);

    const row = await prisma.ccwFinancialClaim.create({
      data: {
        ownerUserId: scope.userId,
        statementId: id,
        scenarioId: text(body.scenario_id) || null,
        claimType,
        label,
        valueAud,
        state,
        sourceSystem,
        xeroAccountCode: text(body.xero_account_code) || null,
        xeroTenantId: text(body.xero_tenant_id) || null,
        notes: text(body.notes) || null,
        adjustedBy: state === 'toby_adjusted' ? scope.userId : null,
        adjustedAt: state === 'toby_adjusted' ? new Date() : null,
        backedAt: state === 'xero_backed' ? new Date() : null,
        evidence:
          state === 'xero_backed' || sourceReference
            ? {
                create: {
                  evidenceType: 'source_reference',
                  sourceSystem,
                  sourceReference: sourceReference || null,
                  sourceUrl: sourceUrl || null,
                  amountAud: valueAud,
                  payload: {
                    xero_account_code: text(body.xero_account_code) || null,
                    captured_by: scope.userId,
                  },
                },
              }
            : undefined,
      },
      include: { evidence: { orderBy: { capturedAt: 'desc' }, take: 5 } },
    });

    return NextResponse.json(
      {
        id: row.id,
        claim_type: row.claimType,
        label: row.label,
        value_aud: row.valueAud,
        state: row.state,
        source_system: row.sourceSystem,
        xero_account_code: row.xeroAccountCode,
        backed_at: row.backedAt?.toISOString() ?? null,
        evidence: row.evidence.map((evidence) => ({
          id: evidence.id,
          source_system: evidence.sourceSystem,
          source_reference: evidence.sourceReference,
          amount_aud: evidence.amountAud,
          captured_at: evidence.capturedAt.toISOString(),
        })),
      },
      { status: 201 }
    );
  } catch (e) {
    return NextResponse.json({ detail: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
