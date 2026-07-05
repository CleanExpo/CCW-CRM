import { LoginForm } from '@/components/auth/login-form';
import { AuthPageShell } from '@/components/auth/auth-page-shell';
import { Suspense } from 'react';

function LoginFormFallback() {
  return (
    <div className="flex min-h-[200px] items-center justify-center">
      <div className="border-primary/40 h-8 w-8 animate-spin rounded-full border-2 border-t-primary" />
    </div>
  );
}

export default function LoginPage() {
  return (
    <AuthPageShell title="CCW Online" description="Sign in to your account to continue">
      <Suspense fallback={<LoginFormFallback />}>
        <LoginForm variant="marketing" />
      </Suspense>
    </AuthPageShell>
  );
}
