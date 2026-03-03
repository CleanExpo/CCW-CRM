import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Phone Orders | CCW Online',
  description:
    'Place a phone order with CCW Online for professional carpet cleaning equipment and restoration supplies. Call 1300 229 273.',
  openGraph: {
    title: 'CCW Phone Orders',
    url: 'https://ccwonline.com.au/phone',
  },
  alternates: {
    canonical: 'https://ccwonline.com.au/phone',
  },
};

export default function PhoneLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
