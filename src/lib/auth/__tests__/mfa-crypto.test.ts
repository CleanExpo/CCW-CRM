import {
  decryptTotpSecret,
  encryptTotpSecret,
  generateRecoveryCodes,
  hashRecoveryCode,
} from '@/lib/auth/mfa-crypto';
import { createTotp, generateTotpSecret, verifyTotpCode } from '@/lib/auth/mfa-totp';
import { beforeAll, describe, expect, it } from 'vitest';

beforeAll(() => {
  process.env.MFA_ENCRYPTION_KEY = 'test-mfa-key-for-unit-tests-only';
});

describe('mfa crypto', () => {
  it('round-trips TOTP secrets', () => {
    const secret = generateTotpSecret();
    const enc = encryptTotpSecret(secret);
    expect(enc.startsWith('v1:')).toBe(true);
    expect(decryptTotpSecret(enc)).toBe(secret);
  });

  it('hashes recovery codes case-insensitively', () => {
    const code = 'ABCD-EF12';
    expect(hashRecoveryCode(code)).toBe(hashRecoveryCode('abcd-ef12'));
    expect(generateRecoveryCodes(3)).toHaveLength(3);
  });

  it('verifies a live TOTP code', () => {
    const secret = generateTotpSecret();
    const token = createTotp(secret, 'test@example.com').generate();
    expect(verifyTotpCode(secret, token)).toBe(true);
    expect(verifyTotpCode(secret, '000000')).toBe(false);
  });
});
