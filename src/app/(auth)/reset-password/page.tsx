import Link from 'next/link';
import { AuthPageShell } from '@/components/auth/auth-page-shell';
import { Button } from '@/components/ui/button';

/** Placeholder: full token reset UI depends on backend email flow. */
export default function ResetPasswordPage() {
  return (
    <AuthPageShell
      title="Reset password"
      description="Use the link from your email, or request a new reset below."
    >
      <div className="space-y-4 text-center text-sm text-zinc-300">
        <p>If your link expired, request a new one from the forgot-password page.</p>
        <Button asChild variant="gradient" className="w-full rounded-xl">
          <Link href="/forgot-password">Request reset email</Link>
        </Button>
        <Button
          asChild
          variant="outline"
          className="w-full border-zinc-600 bg-zinc-900/50 text-zinc-100 hover:bg-zinc-800"
        >
          <Link href="/login">Back to sign in</Link>
        </Button>
      </div>
    </AuthPageShell>
  );
}
