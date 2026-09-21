import { NextRequest, NextResponse } from 'next/server';
import { requireAuthScope } from '@/lib/auth/data-scope';
import { getWorkspaceMemberUserIds } from '@/lib/auth/workspace-scope';
import * as fitment from '@/lib/fitment/fitment-service';
import type { FitmentAudience } from '@/lib/fitment/rules';

/**
 * UNI-2748 read API.
 *   ?machine_product_id=  products that fit a machine
 *   ?product_id=          machines a product fits
 *   ?equipment_id=        what a customer-owned machine takes
 *   (none)                paged staff list, ?status= ?search=
 * ?audience=customer returns confirmed rows only, in the customer shape.
 */
export async function GET(request: NextRequest) {
  try {
    const scope = await requireAuthScope(request);
    if (!scope) return NextResponse.json({ detail: 'Not authenticated' }, { status: 401 });
    const ids = await getWorkspaceMemberUserIds(scope.userId);
    const sp = new URL(request.url).searchParams;
    const audience: FitmentAudience = sp.get('audience') === 'customer' ? 'customer' : 'staff';
    const shape = audience === 'customer' ? fitment.fitmentToCustomerApi : fitment.fitmentToApi;

    const machineProductId = sp.get('machine_product_id');
    if (machineProductId) {
      const rows = await fitment.listFitsForMachine(ids, machineProductId, audience);
      return NextResponse.json({ items: rows.map(shape) });
    }
    const productId = sp.get('product_id');
    if (productId) {
      const rows = await fitment.listMachinesForProduct(ids, productId, audience);
      return NextResponse.json({
        items: rows.map((r) =>
          audience === 'customer'
            ? {
                kind: r.kind,
                machine: {
                  id: r.machineProduct.id,
                  name: r.machineProduct.name,
                  sku: r.machineProduct.sku,
                },
              }
            : fitment.fitmentToApi(r)
        ),
      });
    }
    const equipmentId = sp.get('equipment_id');
    if (equipmentId) {
      const res = await fitment.listFitsForEquipment(ids, equipmentId, audience);
      if (!res) return NextResponse.json({ detail: 'Equipment not found' }, { status: 404 });
      return NextResponse.json({
        linked: res.linked,
        machine_product_id: res.machineProductId,
        items: res.fits.map(shape),
      });
    }

    if (audience === 'customer') {
      return NextResponse.json(
        { detail: 'A machine, product or equipment id is required' },
        { status: 400 }
      );
    }
    const page = Math.max(parseInt(sp.get('page') || '1', 10) || 1, 1);
    const pageSize = Math.min(Math.max(parseInt(sp.get('page_size') || '50', 10) || 50, 1), 200);
    const { rows, total } = await fitment.listFitments(ids, {
      status: sp.get('status') || undefined,
      search: sp.get('search') || undefined,
      page,
      pageSize,
    });
    return NextResponse.json({
      items: rows.map(fitment.fitmentToApi),
      total,
      page,
      page_size: pageSize,
    });
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
    const row = await fitment.createFitment(ids, scope.userId, {
      machineProductId: String(body.machine_product_id ?? ''),
      fitProductId: String(body.fit_product_id ?? ''),
      kind: String(body.kind ?? ''),
      usageQuantity: body.usage_quantity == null ? null : Number(body.usage_quantity),
      usagePer: body.usage_per ?? null,
    });
    return NextResponse.json(fitment.fitmentToApi(row), { status: 201 });
  } catch (e) {
    if (e instanceof fitment.FitmentInputError) {
      return NextResponse.json({ detail: e.message }, { status: 400 });
    }
    return NextResponse.json({ detail: String(e) }, { status: 500 });
  }
}
