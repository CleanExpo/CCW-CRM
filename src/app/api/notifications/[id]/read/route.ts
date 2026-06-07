import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { requireAuthScope } from '@/lib/auth/data-scope';

export async function POST(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const scope = await requireAuthScope(_request);
    if (!scope) return NextResponse.json({ detail: 'Not authenticated' }, { status: 401 });

    const { id } = await context.params;
    const row = await prisma.inAppNotification.updateMany({
      where: { id, userId: scope.userId },
      data: { isRead: true },
    });
    if (row.count === 0) {
      return NextResponse.json({ detail: 'Not found' }, { status: 404 });
    }
    const updated = await prisma.inAppNotification.findUnique({ where: { id } });
    return NextResponse.json({
      id: updated!.id,
      user_id: updated!.userId,
      title: updated!.title,
      message: updated!.message,
      notification_type: updated!.notificationType,
      entity_type: updated!.entityType,
      entity_id: updated!.entityId,
      is_read: updated!.isRead,
      created_at: updated!.createdAt.toISOString(),
    });
  } catch (e) {
    return NextResponse.json({ detail: String(e) }, { status: 500 });
  }
}
