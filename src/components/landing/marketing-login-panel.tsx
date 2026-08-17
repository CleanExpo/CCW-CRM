'use client';

import dynamic from 'next/dynamic';
import { Suspense } from 'react';

function LoginFormFallback() {
  return (
    <div className="flex min-h-[200px] items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-sky-500/30 border-t-sky-400" />
    </div>
  );
}

const LoginForm = dynamic(
  () => import('@/components/auth/login-form').then((m) => ({ default: m.LoginForm })),
  {
    ssr: false,
    loading: () => <LoginFormFallback />,
  }
);

/** Client boundary so `ssr: false` is valid for the marketing sign-in embed. */
export function MarketingLoginPanel() {
  return (
    <Suspense fallback={<LoginFormFallback />}>
      <LoginForm variant="marketing" />
    </Suspense>
  );
}

export default MarketingLoginPanel;
