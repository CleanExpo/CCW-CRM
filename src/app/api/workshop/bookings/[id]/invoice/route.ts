import { NextRequest, NextResponse } from 'next/server';
import { requireAuthScope } from '@/lib/auth/data-scope';
import { getWorkspaceMemberUserIds } from '@/lib/auth/workspace-scope';
import {
  createInvoiceDraftFromBooking,
  PlanInvoiceBlockedError,
  previewBookingInvoice,
  ServicePlanError,
} from '@/lib/workshop/service-plans';

type Ctx = { params: Promise<{ id: string }> };

/** UNI-2750: what the invoice would carry (rounded XLABOUR hours and the kit). Read only. */
export async function GET(request: NextRequest, context: Ctx) {
  try {
    const scope = await requireAuthScope(request);
    if (!scope) return NextResponse.json({ detail: 'Not authenticated' }, { status: 401 });
    const { id } = await context.params;
    const ids = await getWorkspaceMemberUserIds(scope.userId);
    return NextResponse.json(await previewBookingInvoice(ids, id));
  } catch (e) {
    if (e instanceof ServicePlanError) {
      return NextResponse.json({ detail: e.message }, { status: e.status });
    }
    return NextResponse.json({ detail: String(e) }, { status: 500 });
  }
}

/** Blocked: see PLAN_INVOICE_BLOCKED_DETAIL. Returns 409 and writes nothing. */
export async function POST(request: NextRequest) {
  const scope = await requireAuthScope(request);
  if (!scope) return NextResponse.json({ detail: 'Not authenticated' }, { status: 401 });
  try {
    await createInvoiceDraftFromBooking();
    return NextResponse.json({ detail: 'unreachable' }, { status: 500 });
  } catch (e) {
    if (e instanceof PlanInvoiceBlockedError) {
      return NextResponse.json({ code: e.code, detail: e.message }, { status: e.status });
    }
    return NextResponse.json({ detail: String(e) }, { status: 500 });
  }
}
