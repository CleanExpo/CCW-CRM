import type { Metadata } from 'next';
import { TermsPublicPage } from '@/components/landing/pages/terms-public-page';

export const metadata: Metadata = {
  title: 'Terms of Service — CCW Online ERP',
  description: 'Terms for using CCW Online ERP: accounts, acceptable use, data processing, and governing law overview.',
};

export default function TermsPage() {
  return <TermsPublicPage />;
}
