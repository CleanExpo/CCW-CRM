import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { requireAuthScope } from '@/lib/auth/data-scope';

export async function GET(request: NextRequest) {
  try {
    const scope = await requireAuthScope(request);
    if (!scope) return NextResponse.json({ detail: 'Not authenticated' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('user_id') ?? scope.userId;

    const rows = await prisma.inAppNotification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    return NextResponse.json(
      rows.map((n) => ({
        id: n.id,
        user_id: n.userId,
        title: n.title,
        message: n.message,
        notification_type: n.notificationType,
        entity_type: n.entityType,
        entity_id: n.entityId,
        is_read: n.isRead,
        created_at: n.createdAt.toISOString(),
      }))
    );
  } catch (e) {
    return NextResponse.json({ detail: String(e) }, { status: 500 });
  }
}
