import { NextRequest, NextResponse } from 'next/server';
import { requireAuthScope } from '@/lib/auth/data-scope';
import { getWorkspaceMemberUserIds } from '@/lib/auth/workspace-scope';
import * as mole from '@/lib/price-mole/price-mole-service';

export async function GET(request: NextRequest) {
  try {
    const scope = await requireAuthScope(request);
    if (!scope) return NextResponse.json({ detail: 'Not authenticated' }, { status: 401 });
    const ids = await getWorkspaceMemberUserIds(scope.userId);
    const productId = new URL(request.url).searchParams.get('product_id') || undefined;
    const rows = await mole.listCompetitorProducts(ids, productId);
    const now = new Date();
    return NextResponse.json({ items: rows.map((r) => mole.competitorToApi(r, now)) });
  } catch (e) {
    return NextResponse.json({ detail: String(e) }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const scope = await requireAuthScope(request);
    if (!scope) return NextResponse.json({ detail: 'Not authenticated' }, { status: 401 });
    const ids = await getWorkspaceMemberUserIds(scope.userId);
    const body = await request.json();
    const row = await mole.createCompetitorProduct(ids, scope.userId, {
      competitor: String(body.competitor ?? ''),
      url: String(body.url ?? ''),
      productSku: body.product_sku ?? null,
      competitorSku: body.competitor_sku ?? null,
    });
    return NextResponse.json({ id: row.id }, { status: 201 });
  } catch (e) {
    if (e instanceof mole.PriceMoleInputError) {
      return NextResponse.json({ detail: e.message }, { status: 400 });
    }
    if (String(e).includes('Unique constraint')) {
      return NextResponse.json({ detail: 'That page is already tracked' }, { status: 409 });
    }
    return NextResponse.json({ detail: String(e) }, { status: 500 });
  }
}
