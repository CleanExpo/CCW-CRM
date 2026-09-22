import { AuthPageShell } from '@/components/auth/auth-page-shell';
import { MarketingLoginPanel } from '@/components/landing/marketing-login-panel';

export default function LoginPage() {
  return (
    <AuthPageShell title="CCW Online" description="Sign in to your account to continue">
      <MarketingLoginPanel />
    </AuthPageShell>
  );
}
