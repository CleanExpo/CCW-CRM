import { RegisterForm } from '@/components/auth/register-form';
import { AuthPageShell } from '@/components/auth/auth-page-shell';

export default function RegisterPage() {
  return (
    <AuthPageShell
      title="Create your account"
      description="Get access to quotes, inventory, and operations in one place."
    >
      <RegisterForm />
    </AuthPageShell>
  );
}
