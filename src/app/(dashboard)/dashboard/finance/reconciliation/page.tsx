'use client';

import { ErrorBoundary } from '@/components/errors/ErrorBoundary';
import { ReconciliationDashboard } from '@/app/(dashboard)/reconciliation/components/ReconciliationDashboard';
import { OperationsPageHeader } from '@/components/operations/OperationsPageHeader';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function FinanceReconciliationOverviewPage() {
  return (
    <ErrorBoundary>
      <div className="space-y-6">
        <OperationsPageHeader
          title="Bank reconciliation"
          description="Overview of pending matches and confidence-scored suggestions."
          actions={
            <Button asChild>
              <Link href="/dashboard/finance/reconciliation/workbench">Open workbench</Link>
            </Button>
          }
        />
        <ReconciliationDashboard />
      </div>
    </ErrorBoundary>
  );
}
