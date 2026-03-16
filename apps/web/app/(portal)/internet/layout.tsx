import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Internet Orders | CCW Online',
  description:
    'Browse and order professional carpet cleaning machines, chemicals, and restoration equipment online. Australia-wide shipping from CCW Online.',
  openGraph: {
    title: 'CCW Internet Orders',
    url: 'https://ccwonline.com.au/internet',
  },
  alternates: {
    canonical: 'https://ccwonline.com.au/internet',
  },
};

export default function InternetLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
