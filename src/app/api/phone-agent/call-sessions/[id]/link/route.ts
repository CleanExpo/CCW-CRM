import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { requireAuthScope } from '@/lib/auth/data-scope';
import { getWorkspaceMemberUserIds } from '@/lib/auth/workspace-scope';

type Params = { params: Promise<{ id: string }> };

function text(value: unknown, fallback = '') {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

export async function POST(request: NextRequest, { params }: Params) {
  try {
    const scope = await requireAuthScope(request);
    if (!scope) return NextResponse.json({ detail: 'Not authenticated' }, { status: 401 });

    const { id } = await params;
    const workspaceUserIds = await getWorkspaceMemberUserIds(scope.userId);
    const call = await prisma.ccwAiCallSession.findFirst({
      where: { id, ownerUserId: { in: workspaceUserIds } },
      select: { id: true, summary: true, intent: true, outcome: true, transcript: true },
    });
    if (!call) return NextResponse.json({ detail: 'Call session not found' }, { status: 404 });

    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const customerId = text(body.customer_id) || null;
    const contactId = text(body.contact_id) || null;
    if (!customerId && !contactId) {
      return NextResponse.json({ detail: 'customer_id or contact_id is required' }, { status: 400 });
    }

    if (customerId) {
      const customer = await prisma.customer.findFirst({
        where: { id: customerId, ownerUserId: { in: workspaceUserIds } },
        select: { id: true },
      });
      if (!customer) return NextResponse.json({ detail: 'Customer not found' }, { status: 400 });
    }

    if (contactId) {
      const contact = await prisma.crmContact.findFirst({
        where: { id: contactId, ownerUserId: { in: workspaceUserIds } },
        select: { id: true, customerId: true },
      });
      if (!contact) return NextResponse.json({ detail: 'Contact not found' }, { status: 400 });
      if (customerId && contact.customerId && contact.customerId !== customerId) {
        return NextResponse.json({ detail: 'Contact does not belong to the selected customer' }, { status: 400 });
      }
    }

    const updated = await prisma.$transaction(async (tx) => {
      const linked = await tx.ccwAiCallSession.update({
        where: { id: call.id },
        data: {
          customerId,
          contactId,
        },
      });

      const activity = await tx.crmActivity.create({
        data: {
          ownerUserId: scope.userId,
          activityType: 'call',
          subject: call.summary || `Phone agent call: ${call.intent ?? 'unclassified'}`,
          description: [
            `Intent: ${call.intent ?? 'unknown'}`,
            `Outcome: ${call.outcome ?? 'unknown'}`,
            call.transcript ? `Transcript:\n${call.transcript.slice(0, 4000)}` : null,
          ]
            .filter(Boolean)
            .join('\n\n'),
          customerId,
          contactId,
          createdBy: scope.userId,
        },
      });

      return { linked, activity };
    });

    return NextResponse.json({
      call_session_id: updated.linked.id,
      customer_id: updated.linked.customerId,
      contact_id: updated.linked.contactId,
      crm_activity_id: updated.activity.id,
      crm_activity_type: updated.activity.activityType,
    });
  } catch (e) {
    return NextResponse.json({ detail: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
