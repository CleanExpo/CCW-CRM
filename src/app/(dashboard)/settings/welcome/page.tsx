import type { Metadata } from 'next';
import { Suspense } from 'react';
import { WelcomeOnboarding } from './welcome-onboarding';

export const metadata: Metadata = {
  title: 'Welcome',
  description: 'Get started with your CCW workspace — integrations, team, and core modules.',
  robots: { index: false, follow: false },
};

function WelcomeFallback() {
  return (
    <div className="flex min-h-[45vh] flex-col items-center justify-center gap-2 text-zinc-500">
      <div className="h-8 w-8 animate-pulse rounded-full border-2 border-primary/40 border-t-primary" />
      <span className="text-sm">Loading welcome…</span>
    </div>
  );
}

export default function WelcomePage() {
  return (
    <Suspense fallback={<WelcomeFallback />}>
      <WelcomeOnboarding />
    </Suspense>
  );
}
