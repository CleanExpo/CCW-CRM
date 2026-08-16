import { AuthPageShell } from '@/components/auth/auth-page-shell';
import { RegisterForm } from '@/components/auth/register-form';
import { isPublicRegistrationEnabled } from '@/lib/auth/public-registration';
import Link from 'next/link';

export default function RegisterPage() {
  if (!isPublicRegistrationEnabled()) {
    return (
      <AuthPageShell
        title="Registration is closed"
        description="New Optix accounts are created by an administrator. Self-registration is off."
      >
        <p className="text-muted-foreground text-sm">
          If you already have an account,{' '}
          <Link href="/login" className="text-primary font-medium hover:underline">
            sign in
          </Link>
          .
        </p>
      </AuthPageShell>
    );
  }

  return (
    <AuthPageShell
      title="Create your account"
      description="Get access to quotes, inventory, and operations in one place."
    >
      <RegisterForm />
    </AuthPageShell>
  );
}
