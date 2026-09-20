/**
 * Toby 3 Sep 2026: no customer contact until Phase 1 stock is signed
 * and the workshop pilot scope note is agreed.
 */
export const WORKSHOP_OUTREACH_BLOCKED_CODE = 'WORKSHOP_OUTREACH_BLOCKED';

export const WORKSHOP_OUTREACH_BLOCKED_DETAIL =
  'Customer outreach is blocked. Phase 1 stock is not signed, the workshop scope note is not agreed, and a wrong machine or customer cannot be undone.';

export class WorkshopOutreachBlockedError extends Error {
  readonly code = WORKSHOP_OUTREACH_BLOCKED_CODE;
  readonly status = 409;

  constructor(message = WORKSHOP_OUTREACH_BLOCKED_DETAIL) {
    super(message);
    this.name = 'WorkshopOutreachBlockedError';
  }
}

export function assertWorkshopCustomerOutreachAllowed(): never {
  throw new WorkshopOutreachBlockedError();
}
