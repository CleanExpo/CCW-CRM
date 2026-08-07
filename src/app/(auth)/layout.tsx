import { AuthSiteShell } from '@/components/auth/auth-site-shell';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  // HotToaster lives in the root layout so the marketing-embedded LoginForm
  // and the dedicated auth routes share one host.
  return <AuthSiteShell>{children}</AuthSiteShell>;
}
