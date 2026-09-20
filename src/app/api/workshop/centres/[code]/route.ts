import { NextRequest, NextResponse } from 'next/server';
import { requireAuthScope } from '@/lib/auth/data-scope';
import * as workshop from '@/lib/db/workshop-service';

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ code: string }> }
) {
  try {
    const scope = await requireAuthScope(request);
    if (!scope) return NextResponse.json({ detail: 'Not authenticated' }, { status: 401 });
    const { code } = await context.params;
    const body = await request.json();
    const row = await workshop.updateWorkshopCentre(scope.userId, code, body);
    if (!row) return NextResponse.json({ detail: 'Unknown centre' }, { status: 404 });
    return NextResponse.json(row);
  } catch (e) {
    return NextResponse.json({ detail: String(e) }, { status: 500 });
  }
}
