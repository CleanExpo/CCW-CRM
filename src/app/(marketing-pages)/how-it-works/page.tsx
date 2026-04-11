import type { Metadata } from 'next';
import { HowItWorksPublicPage } from '@/components/landing/pages/how-it-works-public-page';

export const metadata: Metadata = {
  title: 'How it works — CCW Online ERP',
  description:
    'A phased rollout: map workflows, connect systems, train by role, then operate with dashboards, alerts, and honest visibility.',
};

export default function HowItWorksPage() {
  return <HowItWorksPublicPage />;
}
