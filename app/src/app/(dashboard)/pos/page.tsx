'use client';

import { POSTerminal } from './components/POSTerminal';
import { ErrorBoundary } from '@/components/errors/ErrorBoundary';

export default function POSPage() {
  return (
    <ErrorBoundary>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Point of Sale</h1>
          <p className="text-muted-foreground">Process walk-in sales and payments</p>
        </div>

        <POSTerminal />
      </div>
    </ErrorBoundary>
  );
}
