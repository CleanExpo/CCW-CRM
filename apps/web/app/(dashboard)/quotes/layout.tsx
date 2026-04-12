import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Quotes',
  description:
    'Create and manage CCW sales quotes — line items, pricing, and quote-to-order conversion.',
  robots: { index: false, follow: false },
};

export default function QuotesLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
