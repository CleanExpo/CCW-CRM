'use client';

import { ErrorBoundary } from '@/components/errors/ErrorBoundary';
import { OperationsPageHeader } from '@/components/operations/OperationsPageHeader';
import { ReconciliationWorkbench } from '@/components/bank-reconciliation/ReconciliationWorkbench';

export default function FinanceReconciliationWorkbenchPage() {
  return (
    <ErrorBoundary>
      <div className="space-y-6">
        <OperationsPageHeader
          title="Bank reconciliation workbench"
          description="Match bank feed lines to invoices, bills, and POs with confidence scoring, splits, rules, and full audit trail."
        />
        <ReconciliationWorkbench />
      </div>
    </ErrorBoundary>
  );
}
