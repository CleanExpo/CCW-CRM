import { AuthSiteShell } from '@/components/auth/auth-site-shell';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return <AuthSiteShell>{children}</AuthSiteShell>;
}
