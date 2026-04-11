import type { Metadata } from 'next';
import { PricingPublicPage } from '@/components/landing/pages/pricing-public-page';

export const metadata: Metadata = {
  title: 'Pricing — CCW Online ERP',
  description:
    'Packaging aligned to branches, SKUs, integrations, and support—scoped honestly for equipment distributors.',
};

export default function PricingPage() {
  return <PricingPublicPage />;
}
