import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ForgotPasswordForm } from '@/components/auth/forgot-password-form';

export const metadata = {
  title: 'Reset Password — CCW Online',
  description: 'Request a password reset link for your CCW Online account.',
};

export default function ForgotPasswordPage() {
  return (
    <Card className="w-full">
      <CardHeader className="space-y-1">
        <CardTitle className="text-center text-2xl font-bold" as="h1">
          CCW Online
        </CardTitle>
        <CardDescription className="text-center">
          Enter your email and we'll send you a reset link
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ForgotPasswordForm />
      </CardContent>
    </Card>
  );
}
