import { describe, expect, it } from 'vitest';

import {
  assertWorkshopCustomerOutreachAllowed,
  WORKSHOP_OUTREACH_BLOCKED_CODE,
  WorkshopOutreachBlockedError,
} from '../customer-outreach-gate';
import { inferCentreCode } from '../centres';

describe('workshop customer outreach gate', () => {
  it('refuses every send until stock and scope are signed', () => {
    expect(() => assertWorkshopCustomerOutreachAllowed()).toThrow(WorkshopOutreachBlockedError);
    try {
      assertWorkshopCustomerOutreachAllowed();
    } catch (e) {
      expect(e).toBeInstanceOf(WorkshopOutreachBlockedError);
      expect((e as WorkshopOutreachBlockedError).code).toBe(WORKSHOP_OUTREACH_BLOCKED_CODE);
      expect((e as WorkshopOutreachBlockedError).status).toBe(409);
    }
  });
});

describe('inferCentreCode', () => {
  it('maps workshop locations to Toby’s three centres', () => {
    expect(inferCentreCode('Brisbane workshop')).toBe('brisbane');
    expect(inferCentreCode('QLD1')).toBe('brisbane');
    expect(inferCentreCode('Sydney')).toBe('sydney');
    expect(inferCentreCode('NSW depot')).toBe('sydney');
    expect(inferCentreCode('Melbourne')).toBe('melbourne');
    expect(inferCentreCode('VIC2')).toBe('melbourne');
  });
});
