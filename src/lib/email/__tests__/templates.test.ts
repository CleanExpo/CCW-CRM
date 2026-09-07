/**
 * UNI-2671 A4: the three transactional templates.
 *
 * These assert the words that actually reach a customer. They are pure — no
 * network, no database — so a failure here is a content defect and nothing else.
 */

import { describe, it, expect } from 'vitest';
import {
  buildTeamInvitationEmail,
  buildPasswordResetEmail,
  buildBookingConfirmationEmail,
} from '../templates';

describe('team invitation template', () => {
  const base = {
    inviteeName: 'Sam Rivers',
    inviterName: 'Toby Bredhauer',
    role: 'member',
    acceptUrl: 'https://optix.ccwarehouse.com.au/reset-password?token=abc&invited=1',
    expiresInHours: 48,
  };

  it('names the invitee, the inviter, the role and the expiry', () => {
    const mail = buildTeamInvitationEmail(base);
    expect(mail.template).toBe('team-invitation');
    expect(mail.subject).toBe('You have been invited to Optix');
    expect(mail.text).toContain('Sam Rivers');
    expect(mail.text).toContain('Toby Bredhauer');
    expect(mail.text).toContain('member');
    expect(mail.text).toContain('48 hours');
  });

  it('carries the accept link in both the text and the HTML part', () => {
    const mail = buildTeamInvitationEmail(base);
    expect(mail.text).toContain(base.acceptUrl);
    // The HTML part escapes `&`, so match on the escaped form.
    expect(mail.html).toContain('token=abc&amp;invited=1');
  });

  it('greets without a name when none is supplied', () => {
    const mail = buildTeamInvitationEmail({ ...base, inviteeName: null, inviterName: null });
    expect(mail.text).toContain('Hello,');
    expect(mail.text).not.toContain('Hello ,');
  });

  it('never contains a password', () => {
    const mail = buildTeamInvitationEmail(base);
    expect(mail.text.toLowerCase()).not.toContain('temporary password');
    expect(mail.html.toLowerCase()).not.toContain('temporary password');
  });
});

describe('password reset template', () => {
  const base = {
    resetUrl: 'https://optix.ccwarehouse.com.au/reset-password?token=deadbeef',
    expiresInMinutes: 60,
  };

  it('states the expiry and single use', () => {
    const mail = buildPasswordResetEmail(base);
    expect(mail.template).toBe('password-reset');
    expect(mail.text).toContain('60 minutes');
    expect(mail.text).toContain('used once');
  });

  it('tells a non-requesting recipient that nothing has changed', () => {
    const mail = buildPasswordResetEmail(base);
    expect(mail.text).toContain('your password has not changed');
  });

  it('carries the reset link in both parts', () => {
    const mail = buildPasswordResetEmail(base);
    expect(mail.text).toContain(base.resetUrl);
    expect(mail.html).toContain('token=deadbeef');
  });
});

describe('booking confirmation template', () => {
  const base = {
    customerName: 'Riverside Plumbing',
    reference: 'WB-00421',
    service: 'Annual service — 6 kg dry chemical extinguisher',
    scheduledFor: 'Tuesday, 15 September 2026 at 9:00 am',
    location: 'Brisbane workshop',
  };

  it('puts the reference in the subject and the body', () => {
    const mail = buildBookingConfirmationEmail(base);
    expect(mail.template).toBe('booking-confirmation');
    expect(mail.subject).toContain('WB-00421');
    expect(mail.text).toContain('WB-00421');
  });

  it('states what, when and where', () => {
    const mail = buildBookingConfirmationEmail(base);
    expect(mail.text).toContain('Annual service');
    expect(mail.text).toContain('Tuesday, 15 September 2026 at 9:00 am');
    expect(mail.text).toContain('Brisbane workshop');
  });

  it('omits the manage link and the notes line when neither is supplied', () => {
    const mail = buildBookingConfirmationEmail(base);
    expect(mail.text).not.toContain('View this booking');
    expect(mail.text).not.toContain('Notes:');
  });

  it('includes the manage link when one is supplied', () => {
    const mail = buildBookingConfirmationEmail({
      ...base,
      manageUrl: 'https://optix.ccwarehouse.com.au/portal/service',
    });
    expect(mail.text).toContain('https://optix.ccwarehouse.com.au/portal/service');
  });
});

describe('HTML escaping', () => {
  it('does not let a customer name inject markup', () => {
    const mail = buildBookingConfirmationEmail({
      customerName: '<script>alert(1)</script>',
      reference: 'WB-1',
      service: 'Service',
      scheduledFor: 'today',
    });
    expect(mail.html).not.toContain('<script>');
    expect(mail.html).toContain('&lt;script&gt;');
  });
});
