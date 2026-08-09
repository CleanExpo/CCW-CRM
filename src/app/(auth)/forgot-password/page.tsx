import { AuthPageShell } from '@/components/auth/auth-page-shell';
import { ForgotPasswordForm } from '@/components/auth/forgot-password-form';

export default function ForgotPasswordPage() {
  return (
    <AuthPageShell
      title="Reset password"
      description="We will email you a link if an account exists for this address."
    >
      <ForgotPasswordForm />
    </AuthPageShell>
  );
}
