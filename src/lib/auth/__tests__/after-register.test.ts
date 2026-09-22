import { describe, expect, it } from 'vitest';

import { pathAfterRegister } from '../after-register';

describe('pathAfterRegister', () => {
  it('sends a sessioned signup to onboarding', () => {
    expect(pathAfterRegister({ access_token: 'tok' })).toBe('/onboarding');
  });

  it('does not send a cookieless MFA challenge to onboarding', () => {
    expect(pathAfterRegister({ mfa_enrollment_required: true })).toBe('/login?registered=1&mfa=1');
  });
});
