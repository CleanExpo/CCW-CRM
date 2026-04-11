import type { Metadata } from 'next';
import { FeaturesPublicPage } from '@/components/landing/pages/features-public-page';

export const metadata: Metadata = {
  title: 'Features — CCW Online ERP',
  description:
    'Quote-to-cash, inventory, finance, fulfilment, integrations, reporting, governance, and AI-in-workflow—modular depth for equipment distributors.',
};

export default function FeaturesPage() {
  return <FeaturesPublicPage />;
}
