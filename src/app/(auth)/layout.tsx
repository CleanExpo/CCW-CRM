import { AuthSiteShell } from '@/components/auth/auth-site-shell';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  // AuthHotToaster mounts in AuthSiteShell (and LoginForm for the marketing embed).
  return <AuthSiteShell>{children}</AuthSiteShell>;
}
