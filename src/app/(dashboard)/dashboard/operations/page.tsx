'use client';

import Link from 'next/link';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { LayoutDashboard } from 'lucide-react';
import { SectionHubModules, type HubModuleItem } from '@/components/dashboard/SectionHubModules';

const MODULES: HubModuleItem[] = [
  {
    title: 'Quotes',
    description: 'Estimates and proposals before they become orders.',
    href: '/dashboard/operations/quotes',
    icon: 'FileText',
  },
  {
    title: 'Sales orders',
    description: 'Customer demand, fulfilment status, and invoicing handoff.',
    href: '/dashboard/operations/orders',
    icon: 'ShoppingCart',
  },
  {
    title: 'Fulfilment',
    description: 'Pick, pack, ship, and payment alignment with Cin7.',
    href: '/dashboard/operations/fulfilment',
    icon: 'PackageCheck',
  },
  {
    title: 'Purchase orders',
    description: 'Supplier commitments and approval-ready procurement.',
    href: '/dashboard/operations/purchase-orders',
    icon: 'ClipboardList',
  },
  {
    title: 'Receiving',
    description: 'Dock receipts against PO lines and put-away.',
    href: '/dashboard/operations/purchase-orders/receiving',
    icon: 'PackagePlus',
  },
  {
    title: 'Point of sale',
    description: 'Retail checkout, terminals, and locations.',
    href: '/dashboard/operations/pos',
    icon: 'Store',
  },
  {
    title: 'POS reconciliation',
    description: 'Till sessions, settlement, and banking alignment.',
    href: '/dashboard/operations/pos/reconciliation',
    icon: 'Scale',
  },
  {
    title: 'Inbound enquiries',
    description: 'Web contact and demo requests from the public site.',
    href: '/dashboard/operations/submissions',
    icon: 'Inbox',
  },
];

export default function OperationsHubPage() {
  return (
    <div className="space-y-8">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <LayoutDashboard className="text-muted-foreground h-8 w-8" aria-hidden />
          <h1 className="text-3xl font-bold tracking-tight">Operations</h1>
        </div>
        <p className="text-muted-foreground mt-1 max-w-2xl text-sm leading-relaxed">
          Quote-to-cash, procurement, store retail, and inbound lead intake — jump to any workflow
          below.
        </p>
      </div>

      <Card className="border-dashed">
        <CardHeader>
          <CardTitle className="text-base">Flow</CardTitle>
          <CardDescription>
            Typical path:{' '}
            <Link className="text-foreground underline-offset-4 hover:underline" href="/dashboard/operations/quotes">
              Quotes
            </Link>{' '}
            →{' '}
            <Link className="text-foreground underline-offset-4 hover:underline" href="/dashboard/operations/orders">
              Sales orders
            </Link>{' '}
            →{' '}
            <Link className="text-foreground underline-offset-4 hover:underline" href="/dashboard/operations/fulfilment">
              Fulfilment
            </Link>
            . Procurement runs as{' '}
            <Link className="text-foreground underline-offset-4 hover:underline" href="/dashboard/operations/purchase-orders">
              POs
            </Link>{' '}
            and{' '}
            <Link className="text-foreground underline-offset-4 hover:underline" href="/dashboard/operations/purchase-orders/receiving">
              receiving
            </Link>
            ; retail uses{' '}
            <Link className="text-foreground underline-offset-4 hover:underline" href="/dashboard/operations/pos">
              POS
            </Link>{' '}
            and{' '}
            <Link className="text-foreground underline-offset-4 hover:underline" href="/dashboard/operations/pos/reconciliation">
              reconciliation
            </Link>
            .
          </CardDescription>
        </CardHeader>
      </Card>

      <SectionHubModules modules={MODULES} heading="All operations areas" />
    </div>
  );
}
