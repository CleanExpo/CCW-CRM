import { NextRequest, NextResponse } from 'next/server';
import { requireAuthScope } from '@/lib/auth/data-scope';
import { getWorkspaceMemberUserIds } from '@/lib/auth/workspace-scope';
import { parsePagination } from '@/lib/workshop/pagination';
import * as workshop from '@/lib/db/workshop-service';
import { sendBookingConfirmation } from '@/lib/email/booking-notification';

export async function GET(request: NextRequest) {
  try {
    const scope = await requireAuthScope(request);
    if (!scope) return NextResponse.json({ detail: 'Not authenticated' }, { status: 401 });

    const workspaceUserIds = await getWorkspaceMemberUserIds(scope.userId);
    const { searchParams } = new URL(request.url);
    const { page, pageSize } = parsePagination(searchParams);
    const location = searchParams.get('location')?.trim() || undefined;
    const status = searchParams.get('status')?.trim() || undefined;
    const equipmentId = searchParams.get('equipment_id')?.trim() || undefined;
    const dateFromRaw = searchParams.get('date_from')?.trim();
    const dateToRaw = searchParams.get('date_to')?.trim();
    const dateFrom = dateFromRaw ? new Date(dateFromRaw) : undefined;
    const dateTo = dateToRaw ? new Date(dateToRaw) : undefined;

    const data = await workshop.listWorkshopBookings(workspaceUserIds, {
      page,
      pageSize,
      location,
      status,
      equipmentId,
      dateFrom,
      dateTo,
    });
    return NextResponse.json(data);
  } catch (e) {
    return NextResponse.json({ detail: String(e) }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const scope = await requireAuthScope(request);
    if (!scope) return NextResponse.json({ detail: 'Not authenticated' }, { status: 401 });

    const workspaceUserIds = await getWorkspaceMemberUserIds(scope.userId);
    const body = (await request.json()) as {
      equipment_id: string;
      service_template_id?: string;
      contractor_id?: string;
      location: string;
      scheduled_date: string;
      customer_notes?: string;
    };
    if (!body.equipment_id || !body.location || !body.scheduled_date) {
      return NextResponse.json(
        { detail: 'equipment_id, location, and scheduled_date are required' },
        { status: 400 }
      );
    }

    const row = await workshop.createWorkshopBooking(workspaceUserIds, scope.userId, body);

    // UNI-2671: booking confirmations were never sent. The booking itself is
    // already committed, so a confirmation failure reports alongside the 201
    // rather than turning a successful booking into an error.
    const confirmation = await sendBookingConfirmation({
      bookingId: row.id,
      bookingNumber: row.booking_number,
      equipmentId: row.equipment_id,
      location: row.location,
      scheduledDate: row.scheduled_date,
      customerNotes: row.customer_notes,
    });

    return NextResponse.json(
      {
        ...row,
        // `sent` is the only value meaning the customer has been told.
        confirmation_email: {
          status: confirmation.status,
          receipt_id: confirmation.receiptId,
          ...('reason' in confirmation ? { reason: confirmation.reason } : {}),
        },
      },
      { status: 201 }
    );
  } catch (e) {
    const msg = String(e);
    const status = msg.includes('not found') ? 400 : 500;
    return NextResponse.json({ detail: msg }, { status });
  }
}
