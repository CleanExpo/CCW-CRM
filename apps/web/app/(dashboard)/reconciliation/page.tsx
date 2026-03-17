/**
 * Reconciliation Dashboard Page (Phase 3)
 *
 * Provides visual oversight of bank feed reconciliation with:
 * - Summary statistics
 * - Pending matches table
 * - AI suggestion cards
 * - Bulk approval workflow
 */

import { Suspense } from 'react';
import { ReconciliationDashboard } from './components/ReconciliationDashboard';
import { ErrorBoundary } from '@/components/errors/ErrorBoundary';

export const metadata = {
  title: 'Reconciliation Dashboard | CCW ERP',
  description: 'Bank feed reconciliation with AI-powered match suggestions',
};

export default function ReconciliationPage() {
  return (
    <ErrorBoundary>
      <div className="flex flex-col gap-6 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Bank Feed Reconciliation</h1>
            <p className="text-muted-foreground mt-2">
              Review and approve AI-suggested transaction matches
            </p>
          </div>
        </div>

        <Suspense fallback={<DashboardSkeleton />}>
          <ReconciliationDashboard />
        </Suspense>
      </div>
    </ErrorBoundary>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      {/* Stats cards skeleton */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="bg-muted h-32 animate-pulse rounded-lg" />
        ))}
      </div>

      {/* Table skeleton */}
      <div className="bg-muted h-96 animate-pulse rounded-lg" />
    </div>
  );
}
