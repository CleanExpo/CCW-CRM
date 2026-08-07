'use client';

import { Toaster } from 'react-hot-toast';

/**
 * Host for react-hot-toast on auth surfaces only.
 * Kept off the root layout so `/` does not pay for the toaster graph before LCP
 * unless the marketing-embedded LoginForm island is mounted.
 */
export function AuthHotToaster() {
  return (
    <Toaster
      position="top-center"
      toastOptions={{
        duration: 4500,
        style: {
          background: 'hsl(240 6% 10%)',
          color: 'hsl(0 0% 98%)',
          border: '1px solid hsl(0 0% 100% / 0.1)',
          boxShadow: '0 25px 50px -12px rgb(0 0 0 / 0.45)',
        },
        success: {
          iconTheme: { primary: '#22c55e', secondary: '#18181b' },
        },
        error: {
          iconTheme: { primary: '#f87171', secondary: '#18181b' },
        },
      }}
    />
  );
}
