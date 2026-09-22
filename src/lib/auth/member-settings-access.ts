/** Paths a `member` may open even though the rest of Workspace settings is owner/admin. */
const MEMBER_ACCOUNT_PATHS = [
  '/dashboard/settings/account',
  '/settings/account',
  '/onboarding',
];

export function memberMayAccessPath(pathname: string): boolean {
  return MEMBER_ACCOUNT_PATHS.some(
    (allowed) => pathname === allowed || pathname.startsWith(`${allowed}/`)
  );
}
