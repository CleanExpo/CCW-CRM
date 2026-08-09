import {
  decryptTotpSecret,
  encryptTotpSecret,
  generateRecoveryCodes,
  hashRecoveryCode,
} from '@/lib/auth/mfa-crypto';
import { prisma } from '@/lib/db/prisma';
import { Secret, TOTP } from 'otpauth';

const ISSUER = process.env.MFA_ISSUER?.trim() || 'Optix / CCW Online';

export function createTotp(secretBase32: string, labelEmail: string): TOTP {
  return new TOTP({
    issuer: ISSUER,
    label: labelEmail,
    algorithm: 'SHA1',
    digits: 6,
    period: 30,
    secret: Secret.fromBase32(secretBase32),
  });
}

export function generateTotpSecret(): string {
  return new Secret({ size: 20 }).base32;
}

export function verifyTotpCode(secretBase32: string, token: string): boolean {
  const totp = createTotp(secretBase32, 'verify');
  const delta = totp.validate({ token: token.replace(/\s/g, ''), window: 1 });
  return delta !== null;
}

export function buildOtpauthUri(secretBase32: string, email: string): string {
  return createTotp(secretBase32, email).toString();
}

/** Every Optix AppUser is an internal account — MFA is enforced unless explicitly disabled. */
export function roleRequiresMfa(_role: string, _isAdmin: boolean): boolean {
  return process.env.MFA_ENFORCE !== 'false';
}

export async function beginMfaEnrollment(
  userId: string,
  email: string
): Promise<{
  secret: string;
  otpauth_uri: string;
  recovery_codes: string[];
}> {
  const secret = generateTotpSecret();
  const encrypted = encryptTotpSecret(secret);
  const recoveryCodes = generateRecoveryCodes(10);

  await prisma.$transaction(async (tx) => {
    await tx.appUser.update({
      where: { id: userId },
      data: {
        totpSecretEncrypted: encrypted,
        totpEnabled: false,
        totpVerifiedAt: null,
      },
    });
    await tx.appUserMfaRecoveryCode.deleteMany({ where: { userId } });
    await tx.appUserMfaRecoveryCode.createMany({
      data: recoveryCodes.map((code) => ({
        userId,
        codeHash: hashRecoveryCode(code),
      })),
    });
  });

  return {
    secret,
    otpauth_uri: buildOtpauthUri(secret, email),
    recovery_codes: recoveryCodes,
  };
}

export async function confirmMfaEnrollment(userId: string, token: string): Promise<boolean> {
  const user = await prisma.appUser.findUnique({
    where: { id: userId },
    select: { totpSecretEncrypted: true },
  });
  if (!user?.totpSecretEncrypted) return false;
  const secret = decryptTotpSecret(user.totpSecretEncrypted);
  if (!verifyTotpCode(secret, token)) return false;

  await prisma.appUser.update({
    where: { id: userId },
    data: { totpEnabled: true, totpVerifiedAt: new Date() },
  });
  return true;
}

export async function verifyUserMfa(
  userId: string,
  code: string
): Promise<'totp' | 'recovery' | null> {
  const user = await prisma.appUser.findUnique({
    where: { id: userId },
    select: { totpEnabled: true, totpSecretEncrypted: true },
  });
  if (!user?.totpEnabled || !user.totpSecretEncrypted) return null;

  const normalized = code.trim();
  if (/^\d{6}$/.test(normalized.replace(/\s/g, ''))) {
    const secret = decryptTotpSecret(user.totpSecretEncrypted);
    if (verifyTotpCode(secret, normalized)) return 'totp';
  }

  const hash = hashRecoveryCode(normalized);
  const recovery = await prisma.appUserMfaRecoveryCode.findFirst({
    where: { userId, codeHash: hash, usedAt: null },
  });
  if (!recovery) return null;

  await prisma.appUserMfaRecoveryCode.update({
    where: { id: recovery.id },
    data: { usedAt: new Date() },
  });
  return 'recovery';
}

export async function disableMfa(userId: string): Promise<void> {
  await prisma.$transaction(async (tx) => {
    await tx.appUser.update({
      where: { id: userId },
      data: {
        totpEnabled: false,
        totpSecretEncrypted: null,
        totpVerifiedAt: null,
      },
    });
    await tx.appUserMfaRecoveryCode.deleteMany({ where: { userId } });
  });
}
