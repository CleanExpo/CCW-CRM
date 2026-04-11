import { ContactMarketingPage } from '@/components/marketing/pages/contact-marketing-page';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Contact — CCW Online ERP',
  description: 'Talk to CCW Online ERP about branches, SKUs, integrations, and rollout planning.',
};

export default function ContactPage() {
  return <ContactMarketingPage />;
}
