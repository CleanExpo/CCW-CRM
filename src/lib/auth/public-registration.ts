/**
 * Public self-registration is closed unless explicitly re-opened.
 * MFA enforcement is pointless if anyone can mint a new unenrolled account.
 */
export function isPublicRegistrationEnabled(): boolean {
  return process.env.ALLOW_PUBLIC_REGISTRATION === 'true';
}

export const PUBLIC_REGISTRATION_CLOSED_DETAIL =
  'Public registration is closed. Ask an administrator to create your account.';
