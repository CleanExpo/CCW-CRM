/**
 * Booking confirmation dispatch (UNI-2671 A2/A3).
 *
 * The workshop booking record carries no email address of its own — the
 * recipient is the customer who owns the equipment being serviced. That lookup
 * lives here rather than in the route so the route stays a thin controller and
 * so the "there is no one to write to" case has somewhere honest to be
 * reported from.
 *
 * `no_recipient` is a real outcome, not an error and not a success: the booking
 * was created, and the customer has a null email on file so nobody was told.
 * Folding that into a 201 with no comment is how a confirmation flow appears to
 * work for months while confirming nothing.
 */

import { prisma } from '@/lib/db/prisma';
import { sendTransactionalEmail, type SendOutcome } from '@/lib/email/mailer';
import { buildBookingConfirmationEmail } from '@/lib/email/templates';
import { appUrl } from '@/lib/email/links';

export type BookingNotificationOutcome =
  | SendOutcome
  | { status: 'no_recipient'; receiptId: null; reason: string };

export type BookingNotificationInput = {
  bookingId: string;
  bookingNumber: string;
  equipmentId: string;
  location: string;
  /** ISO 8601, as returned by the API layer. */
  scheduledDate: string;
  customerNotes?: string | null;
};

/** Australian formatting: the audience is CC Warehouse's Australian customers. */
function formatWhen(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat('en-AU', {
    dateStyle: 'full',
    timeStyle: 'short',
    timeZone: 'Australia/Brisbane',
  }).format(date);
}

/**
 * Send the confirmation for a freshly created booking.
 *
 * Never throws. A booking that was created successfully must not be reported as
 * a failure because the confirmation could not go out — but the caller is told
 * exactly which of those two things happened.
 */
export async function sendBookingConfirmation(
  input: BookingNotificationInput
): Promise<BookingNotificationOutcome> {
  try {
    const equipment = await prisma.workshopEquipment.findUnique({
      where: { id: input.equipmentId },
      select: {
        make: true,
        model: true,
        serialNumber: true,
        customer: { select: { companyName: true, email: true } },
      },
    });

    const to = equipment?.customer?.email?.trim();
    if (!to) {
      return {
        status: 'no_recipient',
        receiptId: null,
        reason:
          'The customer who owns this equipment has no email address on file, so no booking confirmation was sent.',
      };
    }

    const service = equipment
      ? [equipment.make, equipment.model, equipment.serialNumber ? `(${equipment.serialNumber})` : '']
          .filter(Boolean)
          .join(' ')
          .trim()
      : 'Workshop service';

    let manageUrl: string | null = null;
    try {
      manageUrl = appUrl(`/portal/service`);
    } catch {
      // No public base URL configured. The confirmation is still worth sending
      // without a link; a broken link would be worse than none.
      manageUrl = null;
    }

    return await sendTransactionalEmail({
      to,
      email: buildBookingConfirmationEmail({
        customerName: equipment?.customer?.companyName ?? null,
        reference: input.bookingNumber,
        service: service || 'Workshop service',
        scheduledFor: formatWhen(input.scheduledDate),
        location: input.location,
        notes: input.customerNotes ?? null,
        manageUrl,
      }),
    });
  } catch (error) {
    console.error('[workshop/bookings] confirmation email failed', error);
    return {
      status: 'failed',
      receiptId: '',
      reason: error instanceof Error ? error.message : 'confirmation email failed',
    };
  }
}
