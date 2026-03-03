import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Customers',
  description: 'Manage CCW customer accounts, contact details, order history, and CRM activity.',
  robots: { index: false, follow: false },
};

export default function CustomersLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
