'use client';

import Link from 'next/link';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { LayoutDashboard } from 'lucide-react';
import { SectionHubModules, type HubModuleItem } from '@/components/dashboard/SectionHubModules';

const MODULES: HubModuleItem[] = [
  {
    title: 'Workflows',
    description: 'Automation templates and process orchestration.',
    href: '/dashboard/workflows',
    icon: 'GitMerge',
    comingSoon: true,
  },
  {
    title: 'Approvals',
    description: 'Requests awaiting decision across modules.',
    href: '/dashboard/approvals',
    icon: 'CheckCircle',
    comingSoon: true,
  },
  {
    title: 'Alerts',
    description: 'Operational and integration alert inbox.',
    href: '/dashboard/alerts',
    icon: 'Bell',
    comingSoon: true,
  },
  {
    title: 'AI Assistant',
    description: 'Guided answers across your ERP data.',
    href: '/dashboard/ai-reports/ai-assistant',
    icon: 'Bot',
    comingSoon: true,
  },
  {
    title: 'Team',
    description: 'Members, roles, and invitations.',
    href: '/dashboard/settings/team',
    icon: 'Users',
  },
  {
    title: 'Billing',
    description: 'Subscription and payment method for CCW Online.',
    href: '/dashboard/settings/billing',
    icon: 'CreditCard',
    comingSoon: true,
  },
  {
    title: 'Integrations',
    description: 'Shopify, Cin7, email, and third-party connections.',
    href: '/dashboard/settings/integrations',
    icon: 'Settings',
  },
  {
    title: 'Shadow programme',
    description: 'Compare assistant outputs against production safely.',
    href: '/dashboard/settings/shadow',
    icon: 'Eye',
  },
];

export default function WorkspaceHubPage() {
  return (
    <div className="space-y-8">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <LayoutDashboard className="text-muted-foreground h-8 w-8" aria-hidden />
          <h1 className="text-3xl font-bold tracking-tight">Workspace</h1>
        </div>
        <p className="text-muted-foreground mt-1 max-w-2xl text-sm leading-relaxed">
          Platform automation, team access, integrations, and experiments — everything outside core
          day-to-day ops lives here.
        </p>
      </div>

      <Card className="border-dashed">
        <CardHeader>
          <CardTitle className="text-base">Tip</CardTitle>
          <CardDescription>
            Active integrations and team access are under{' '}
            <Link className="text-foreground underline-offset-4 hover:underline" href="/dashboard/settings/integrations">
              Integrations
            </Link>{' '}
            and{' '}
            <Link className="text-foreground underline-offset-4 hover:underline" href="/dashboard/settings/team">
              Team
            </Link>
            . Workflow and AI surfaces marked “Soon” stay visible for roadmap alignment.
          </CardDescription>
        </CardHeader>
      </Card>

      <SectionHubModules modules={MODULES} heading="Workspace modules" />
    </div>
  );
}
