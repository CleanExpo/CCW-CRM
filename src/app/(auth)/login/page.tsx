import { LoginForm } from '@/components/auth/login-form';
import { AuthPageShell } from '@/components/auth/auth-page-shell';

export default function LoginPage() {
  return (
    <AuthPageShell title="CCW Online" description="Sign in to your account to continue">
      <LoginForm variant="marketing" />
    </AuthPageShell>
  );
}
