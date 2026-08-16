import { isPublicRegistrationEnabled } from '@/lib/auth/public-registration';
import { afterEach, describe, expect, it, vi } from 'vitest';

describe('isPublicRegistrationEnabled', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('is closed unless ALLOW_PUBLIC_REGISTRATION is exactly true', () => {
    vi.stubEnv('ALLOW_PUBLIC_REGISTRATION', 'false');
    expect(isPublicRegistrationEnabled()).toBe(false);
    vi.stubEnv('ALLOW_PUBLIC_REGISTRATION', '1');
    expect(isPublicRegistrationEnabled()).toBe(false);
    vi.stubEnv('ALLOW_PUBLIC_REGISTRATION', 'true');
    expect(isPublicRegistrationEnabled()).toBe(true);
  });
});
