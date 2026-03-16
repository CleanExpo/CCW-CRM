import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Service Request | CCW Online',
  description:
    'Log a service request for your carpet cleaning or restoration equipment. CCW Online provides fast support and repairs across Australia.',
  openGraph: {
    title: 'CCW Service Request',
    url: 'https://ccwonline.com.au/service',
  },
  alternates: {
    canonical: 'https://ccwonline.com.au/service',
  },
};

export default function ServiceLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
