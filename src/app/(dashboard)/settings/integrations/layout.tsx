import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Integrations & setup',
  description:
    'Connect Xero, Shopify, Cin7, and email; run the setup guide; review diagnostics and readiness.',
  robots: { index: false, follow: false },
};

export default function IntegrationsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
