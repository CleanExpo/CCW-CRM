import { NextRequest, NextResponse } from 'next/server';
import { requireAuthScope } from '@/lib/auth/data-scope';
import { getWorkspaceMemberUserIds } from '@/lib/auth/workspace-scope';
import {
  createServicePlan,
  listServicePlans,
  ServicePlanError,
} from '@/lib/workshop/service-plans';

type PlanRow = Awaited<ReturnType<typeof listServicePlans>>[number];

function planToApi(p: PlanRow) {
  return {
    id: p.id,
    equipment_id: p.equipmentId,
    machine: `${p.equipment.make} ${p.equipment.model}`.trim(),
    serial_number: p.equipment.serialNumber,
    customer: p.equipment.customer.companyName,
    service_template_id: p.serviceTemplateId,
    interval_months: p.intervalMonths,
    interval_hours: p.intervalHours,
    price: p.price,
    includes: p.includes,
    start_date: p.startDate.toISOString().slice(0, 10),
    renewal_date: p.renewalDate.toISOString().slice(0, 10),
  };
}

/** UNI-2750: active plans; ?renewal_within_days=30 gives the renewal list. ?equipment_id= filters. */
export async function GET(request: NextRequest) {
  try {
    const scope = await requireAuthScope(request);
    if (!scope) return NextResponse.json({ detail: 'Not authenticated' }, { status: 401 });
    const sp = new URL(request.url).searchParams;
    const within = sp.get('renewal_within_days');
    const ids = await getWorkspaceMemberUserIds(scope.userId);
    const rows = await listServicePlans(ids, {
      withinDays: within === null ? undefined : Math.max(0, parseInt(within, 10) || 0),
    });
    const equipmentId = sp.get('equipment_id');
    return NextResponse.json({
      items: rows.filter((r) => !equipmentId || r.equipmentId === equipmentId).map(planToApi),
    });
  } catch (e) {
    return NextResponse.json({ detail: String(e) }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const scope = await requireAuthScope(request);
    if (!scope) return NextResponse.json({ detail: 'Not authenticated' }, { status: 401 });
    const body = await request.json();
    const num = (v: unknown) => (v === undefined || v === null || v === '' ? null : Number(v));
    const ids = await getWorkspaceMemberUserIds(scope.userId);
    const plan = await createServicePlan(ids, scope.userId, {
      equipmentId: String(body.equipment_id ?? ''),
      serviceTemplateId: body.service_template_id || null,
      intervalMonths: num(body.interval_months),
      intervalHours: num(body.interval_hours),
      price: num(body.price),
      includes: typeof body.includes === 'string' ? body.includes : '',
      startDate: String(body.start_date ?? ''),
    });
    return NextResponse.json({ id: plan.id }, { status: 201 });
  } catch (e) {
    if (e instanceof ServicePlanError) {
      return NextResponse.json({ detail: e.message }, { status: e.status });
    }
    if ((e as { code?: string })?.code === 'P2002') {
      return NextResponse.json(
        { detail: 'This machine already has an active plan' },
        { status: 409 }
      );
    }
    return NextResponse.json({ detail: String(e) }, { status: 500 });
  }
}
