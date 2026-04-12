import { SignupForm } from '@/components/auth/signup-form';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export const metadata = { title: 'Create account — CCW Online' };

export default function RegisterPage() {
  return (
    <Card className="w-full">
      <CardHeader className="space-y-1">
        <CardTitle className="text-center text-2xl font-bold" as="h1">
          Create your account
        </CardTitle>
        <CardDescription className="text-center">Get started with CCW Online ERP</CardDescription>
      </CardHeader>
      <CardContent>
        <SignupForm />
      </CardContent>
    </Card>
  );
}
