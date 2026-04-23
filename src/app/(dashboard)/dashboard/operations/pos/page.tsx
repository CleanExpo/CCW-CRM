'use client';

import { POSTerminal } from './components/POSTerminal';
import { ErrorBoundary } from '@/components/errors/ErrorBoundary';
import {
  OperationsPageHeader,
  OperationsPageLayout,
} from '@/components/operations/OperationsPageHeader';
import { CreditCard } from 'lucide-react';
import { opCardClass, opHeroSurfaceClass } from '@/lib/operations/ui';
import { cn } from '@/lib/utils';

export default function POSPage() {
  return (
    <ErrorBoundary>
      <OperationsPageLayout className="space-y-6">
        <OperationsPageHeader
          accent="pulse"
          title="Point of sale"
          description="Ring up walk-in sales by location and terminal. Stock and settlements stay tied to your product catalogue."
          icon={CreditCard}
          breadcrumbs={[{ label: 'POS terminal' }]}
        />

        <div className={cn('rounded-2xl border border-border/60 p-4 sm:p-6', opCardClass, opHeroSurfaceClass)}>
          <POSTerminal />
        </div>
      </OperationsPageLayout>
    </ErrorBoundary>
  );
}
