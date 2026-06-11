import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { requireAuthScope } from '@/lib/auth/data-scope';
import { getWorkspaceMemberUserIds } from '@/lib/auth/workspace-scope';

export async function GET(request: NextRequest) {
  try {
    const scope = await requireAuthScope(request);
    if (!scope) return NextResponse.json({ detail: 'Not authenticated' }, { status: 401 });

    const workspaceUserIds = await getWorkspaceMemberUserIds(scope.userId);
    const { searchParams } = new URL(request.url);
    const status =
      searchParams.get('status_filter')?.trim() ?? searchParams.get('status')?.trim();
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '50', 10)));

    const threads = await prisma.emailThread.findMany({
      where: {
        ownerUserId: { in: workspaceUserIds },
        ...(status && status !== 'all' ? { status } : {}),
      },
      orderBy: { lastMessageAt: 'desc' },
      take: limit,
      include: {
        _count: { select: { messages: true } },
      },
    });

    const emails = threads.map((t: (typeof threads)[number]) => ({
      id: t.id,
      thread_id: t.id,
      subject: t.subject,
      customer_email: t.customerEmail,
      customer_name: t.customerName,
      status: t.status as 'open' | 'responded' | 'escalated' | 'closed',
      intent: t.intent,
      message_count: t._count.messages,
      first_message_at: t.createdAt.toISOString(),
      last_message_at: t.lastMessageAt.toISOString(),
    }));

    return NextResponse.json({
      success: true,
      count: emails.length,
      conversations: emails,
    });
  } catch (e) {
    return NextResponse.json({ detail: String(e) }, { status: 500 });
  }
}
