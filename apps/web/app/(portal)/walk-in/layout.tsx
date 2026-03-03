import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Walk-In Orders | CCW Online',
  description:
    'Place a walk-in order for professional carpet cleaning equipment, chemicals, and restoration supplies at CCW Online.',
  openGraph: {
    title: 'CCW Walk-In Orders',
    url: 'https://ccwonline.com.au/walk-in',
  },
  alternates: {
    canonical: 'https://ccwonline.com.au/walk-in',
  },
};

export default function WalkInLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
