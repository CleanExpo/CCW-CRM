import { ForgotPasswordForm } from '@/components/auth/forgot-password-form';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export const metadata = { title: 'Reset password — CCW Online' };

export default function ForgotPasswordPage() {
  return (
    <Card className="w-full">
      <CardHeader className="space-y-1">
        <CardTitle className="text-center text-2xl font-bold" as="h1">
          Reset your password
        </CardTitle>
        <CardDescription className="text-center">
          Enter your email and we&apos;ll send a reset link
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ForgotPasswordForm />
      </CardContent>
    </Card>
  );
}
