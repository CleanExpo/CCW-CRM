import type { Metadata } from 'next';
import { PrivacyPublicPage } from '@/components/landing/pages/privacy-public-page';

export const metadata: Metadata = {
  title: 'Privacy Policy — CCW Online ERP',
  description:
    'How CCW Online collects, uses, stores, and shares personal information. Processors, retention, rights, and breach notification overview.',
};

export default function PrivacyPage() {
  return <PrivacyPublicPage />;
}
