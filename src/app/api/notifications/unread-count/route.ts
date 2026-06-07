import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { requireAuthScope } from '@/lib/auth/data-scope';

export async function GET(request: NextRequest) {
  try {
    const scope = await requireAuthScope(request);
    if (!scope) return NextResponse.json({ detail: 'Not authenticated' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('user_id') ?? scope.userId;

    const count = await prisma.inAppNotification.count({
      where: { userId, isRead: false },
    });

    return NextResponse.json({ count });
  } catch (e) {
    return NextResponse.json({ detail: String(e) }, { status: 500 });
  }
}
