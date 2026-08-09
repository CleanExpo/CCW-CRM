import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto';

const ALGO = 'aes-256-gcm';

function getMfaKey(): Buffer {
  const raw = process.env.MFA_ENCRYPTION_KEY?.trim() || process.env.JWT_SECRET?.trim();
  if (!raw) {
    throw new Error('MFA_ENCRYPTION_KEY (or JWT_SECRET) is required to protect TOTP secrets');
  }
  // Derive a stable 32-byte key from whatever secret is configured.
  return createHash('sha256').update(raw).digest();
}

/** Encrypt a TOTP shared secret for at-rest storage. */
export function encryptTotpSecret(plaintext: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGO, getMfaKey(), iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1:${iv.toString('base64url')}:${tag.toString('base64url')}:${encrypted.toString('base64url')}`;
}

export function decryptTotpSecret(payload: string): string {
  const [version, ivB64, tagB64, dataB64] = payload.split(':');
  if (version !== 'v1' || !ivB64 || !tagB64 || !dataB64) {
    throw new Error('Invalid encrypted TOTP secret format');
  }
  const decipher = createDecipheriv(ALGO, getMfaKey(), Buffer.from(ivB64, 'base64url'));
  decipher.setAuthTag(Buffer.from(tagB64, 'base64url'));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(dataB64, 'base64url')),
    decipher.final(),
  ]);
  return decrypted.toString('utf8');
}

export function hashRecoveryCode(code: string): string {
  return createHash('sha256').update(code.trim().toUpperCase()).digest('hex');
}

export function generateRecoveryCodes(count = 10): string[] {
  const codes: string[] = [];
  for (let i = 0; i < count; i += 1) {
    // 8 chars groups of 4 — easy to type, high entropy
    const raw = randomBytes(5).toString('hex').toUpperCase().slice(0, 8);
    codes.push(`${raw.slice(0, 4)}-${raw.slice(4)}`);
  }
  return codes;
}
