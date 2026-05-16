import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { requireAuthScope } from '@/lib/auth/data-scope';
import { getWorkspaceMemberUserIds } from '@/lib/auth/workspace-scope';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ conversationId: string }> }
) {
  try {
    const scope = await requireAuthScope(request);
    if (!scope) return NextResponse.json({ detail: 'Not authenticated' }, { status: 401 });

    const workspaceUserIds = await getWorkspaceMemberUserIds(scope.userId);
    const { conversationId } = await context.params;

    const thread = await prisma.emailThread.findFirst({
      where: {
        id: conversationId,
        ownerUserId: { in: workspaceUserIds },
      },
      include: {
        messages: { orderBy: { sentAt: 'asc' } },
      },
    });

    if (!thread) {
      return NextResponse.json({ detail: 'Not found' }, { status: 404 });
    }

    const conversation = {
      id: thread.id,
      thread_id: thread.id,
      subject: thread.subject,
      customer_email: thread.customerEmail,
      customer_name: thread.customerName,
      status: thread.status as 'open' | 'responded' | 'escalated' | 'closed',
      intent: thread.intent,
      message_count: thread.messages.length,
      first_message_at: thread.createdAt.toISOString(),
      last_message_at: thread.lastMessageAt.toISOString(),
    };

    const messages = thread.messages.map((m) => ({
      id: m.id,
      direction: m.direction as 'inbound' | 'outbound',
      from_email: m.fromEmail,
      to_email: m.toEmail,
      subject: m.subject,
      body_text: m.bodyText,
      sent_at: m.sentAt.toISOString(),
      was_ai_generated: m.wasAiGenerated,
      delivery_status: m.deliveryStatus ?? undefined,
      delivery_detail: m.deliveryDetail ?? undefined,
    }));

    return NextResponse.json({
      success: true,
      conversation,
      messages,
    });
  } catch (e) {
    return NextResponse.json({ detail: String(e) }, { status: 500 });
  }
}
