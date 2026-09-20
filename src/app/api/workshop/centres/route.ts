import { NextRequest, NextResponse } from 'next/server';
import { requireAuthScope } from '@/lib/auth/data-scope';
import * as workshop from '@/lib/db/workshop-service';

export async function GET(request: NextRequest) {
  try {
    const scope = await requireAuthScope(request);
    if (!scope) return NextResponse.json({ detail: 'Not authenticated' }, { status: 401 });
    const items = await workshop.ensureWorkshopCentres(scope.userId);
    return NextResponse.json({ items });
  } catch (e) {
    return NextResponse.json({ detail: String(e) }, { status: 500 });
  }
}
