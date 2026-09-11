/**
 * The three transactional templates Optix owes its users (UNI-2671 A2):
 * team invitation, password reset, booking confirmation.
 *
 * Each builder is pure — inputs in, rendered strings out, no I/O — so the tests
 * can assert the exact words that reach a customer without a network or a
 * database.
 */

import { renderLayout, type RenderedEmail } from '@/lib/email/templates/layout';

export type { RenderedEmail, TemplateName } from '@/lib/email/templates/layout';
export { escapeHtml, renderLayout } from '@/lib/email/templates/layout';

export type TeamInvitationInput = {
  /** Who is being invited. Used for the greeting; the address is the routing. */
  inviteeName?: string | null;
  /** Who sent the invitation, as the recipient would recognise them. */
  inviterName?: string | null;
  /** The role the invitee is being granted. */
  role: string;
  /** Absolute URL the invitee follows to accept. */
  acceptUrl: string;
  /** Whole hours the link remains valid. */
  expiresInHours: number;
};

export function buildTeamInvitationEmail(input: TeamInvitationInput): RenderedEmail {
  const greeting = input.inviteeName?.trim() ? `Hello ${input.inviteeName.trim()},` : 'Hello,';
  const inviter = input.inviterName?.trim();

  const { text, html } = renderLayout({
    heading: 'You have been invited to Optix',
    paragraphs: [
      greeting,
      inviter
        ? `${inviter} has invited you to join the CC Warehouse Optix workspace as ${input.role}.`
        : `You have been invited to join the CC Warehouse Optix workspace as ${input.role}.`,
      'Optix is the system CC Warehouse uses to run quotes, orders, inventory and service work. Accepting the invitation sets your password and signs you in.',
    ],
    action: { label: 'Accept the invitation', url: input.acceptUrl },
    footnotes: [
      `This invitation expires in ${input.expiresInHours} hours.`,
      'If you were not expecting this invitation, you can ignore this email and no account will be created.',
    ],
  });

  return { template: 'team-invitation', subject: 'You have been invited to Optix', text, html };
}

export type PasswordResetInput = {
  /** Absolute URL carrying the single-use reset token. */
  resetUrl: string;
  /** Whole minutes the link remains valid. */
  expiresInMinutes: number;
};

export function buildPasswordResetEmail(input: PasswordResetInput): RenderedEmail {
  const { text, html } = renderLayout({
    heading: 'Reset your Optix password',
    paragraphs: [
      'Hello,',
      'We received a request to reset the password on your Optix account. Use the link below to choose a new one.',
    ],
    action: { label: 'Choose a new password', url: input.resetUrl },
    footnotes: [
      `This link can be used once and expires in ${input.expiresInMinutes} minutes.`,
      'If you did not request a password reset, no action is needed — your password has not changed.',
    ],
  });

  return { template: 'password-reset', subject: 'Reset your Optix password', text, html };
}

export type BookingConfirmationInput = {
  customerName?: string | null;
  /** Human-facing booking reference. */
  reference: string;
  /** What the booking is for, e.g. "Annual service — 6 kg dry chemical extinguisher". */
  service: string;
  /** Already formatted for the reader; this builder does no timezone maths. */
  scheduledFor: string;
  location?: string | null;
  notes?: string | null;
  /** Optional absolute URL to the booking in the customer portal. */
  manageUrl?: string | null;
};

export function buildBookingConfirmationEmail(input: BookingConfirmationInput): RenderedEmail {
  const greeting = input.customerName?.trim() ? `Hello ${input.customerName.trim()},` : 'Hello,';

  const details = [
    `Reference: ${input.reference}`,
    `Service: ${input.service}`,
    `When: ${input.scheduledFor}`,
    ...(input.location?.trim() ? [`Where: ${input.location.trim()}`] : []),
  ];

  const { text, html } = renderLayout({
    heading: `Booking confirmed — ${input.reference}`,
    paragraphs: [
      greeting,
      'Your booking with CC Warehouse is confirmed. The details are below.',
      details.join('\n'),
      ...(input.notes?.trim() ? [`Notes: ${input.notes.trim()}`] : []),
    ],
    ...(input.manageUrl?.trim()
      ? { action: { label: 'View this booking', url: input.manageUrl.trim() } }
      : {}),
    footnotes: [
      'If you need to change or cancel this booking, reply to this email or contact CC Warehouse.',
    ],
  });

  return {
    template: 'booking-confirmation',
    subject: `Booking confirmed — ${input.reference}`,
    text,
    html,
  };
}
