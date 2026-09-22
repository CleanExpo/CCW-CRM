export function pathAfterRegister(response: {
  access_token?: string | null;
  mfa_enrollment_required?: boolean;
}): string {
  if (response.access_token) return '/onboarding';
  if (response.mfa_enrollment_required) {
    return '/login?registered=1&mfa=1';
  }
  return '/login?registered=1';
}
