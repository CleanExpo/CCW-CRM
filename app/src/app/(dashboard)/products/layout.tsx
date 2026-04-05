import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Products',
  description:
    'Manage CCW product catalogue — carpet cleaning machines, chemicals, restoration equipment, and accessories.',
  robots: { index: false, follow: false },
};

export default function ProductsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
