'use client';

import Link from 'next/link';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { LayoutDashboard } from 'lucide-react';
import { SectionHubModules, type HubModuleItem } from '@/components/dashboard/SectionHubModules';

const MODULES: HubModuleItem[] = [
  {
    title: 'Invoices',
    description: 'AR, payments, and invoice lifecycle.',
    href: '/dashboard/finance/invoices',
    icon: 'Receipt',
  },
  {
    title: 'Debtor Ageing',
    description: 'Per-customer outstanding balances bucketed by days past due. Credit limit usage.',
    href: '/dashboard/finance/debtors',
    icon: 'CreditCard',
  },
  {
    title: 'BAS report',
    description: 'GST summary for Australian BAS preparation.',
    href: '/dashboard/finance/invoices/bas',
    icon: 'FileText',
  },
  {
    title: 'Bank feeds',
    description: 'Automated bank transaction import and matching.',
    href: '/dashboard/finance/bank-feeds',
    icon: 'Landmark',
    comingSoon: true,
  },
  {
    title: 'Emails',
    description: 'Finance-related email threads and notifications.',
    href: '/dashboard/finance/emails',
    icon: 'Mail',
  },
];

export default function FinanceHubPage() {
  return (
    <div className="space-y-8">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <LayoutDashboard className="text-muted-foreground h-8 w-8" aria-hidden />
          <h1 className="text-3xl font-bold tracking-tight">Finance</h1>
        </div>
        <p className="text-muted-foreground mt-1 max-w-2xl text-sm leading-relaxed">
          Invoices, tax reporting, banking visibility, and finance email — open any module below.
        </p>
      </div>

      <Card className="border-dashed">
        <CardHeader>
          <CardTitle className="text-base">Shortcuts</CardTitle>
          <CardDescription>
            Primary ledger work happens in{' '}
            <Link className="text-foreground underline-offset-4 hover:underline" href="/dashboard/finance/invoices">
              Invoices
            </Link>
            . BAS pulls from the same invoice spine; emails and bank feeds extend reconciliation when
            enabled.
          </CardDescription>
        </CardHeader>
      </Card>

      <SectionHubModules modules={MODULES} heading="Finance modules" />
    </div>
  );
}
