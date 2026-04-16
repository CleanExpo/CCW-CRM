'use client';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Building2, Zap, BarChart3, Package } from 'lucide-react';

interface WelcomeStepProps {
  onComplete: (data?: Record<string, unknown>) => void;
  onSkip: () => void;
  onBack: () => void;
  canGoBack: boolean;
  isOptional: boolean;
}

const FEATURES = [
  { icon: Package, label: 'Inventory synced from Shopify' },
  { icon: Building2, label: 'Customers & invoices from Xero' },
  { icon: BarChart3, label: 'Workshop, POS, and sales pipeline' },
  { icon: Zap, label: 'Automated reorder and SLA alerts' },
];

export function WelcomeStep({ onComplete }: WelcomeStepProps) {
  return (
    <div className="space-y-6">
      <div className="space-y-2 text-center">
        <Badge variant="secondary" className="mb-2">
          Welcome to CCW ERP
        </Badge>
        <p className="text-muted-foreground mx-auto max-w-md text-sm">
          Let's get your system connected. This takes about 5 minutes and you'll have your real
          customers, invoices, and stock data inside the ERP automatically.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {FEATURES.map(({ icon: Icon, label }) => (
          <div key={label} className="flex items-center gap-3 rounded-lg border p-3 text-sm">
            <Icon className="text-primary h-4 w-4 shrink-0" />
            <span>{label}</span>
          </div>
        ))}
      </div>

      <div className="bg-muted/50 text-muted-foreground rounded-lg p-4 text-sm">
        <strong className="text-foreground">What you'll need:</strong>
        <ul className="mt-2 list-inside list-disc space-y-1">
          <li>Access to your Xero account (accounting)</li>
          <li>Access to your Shopify admin (stock &amp; products)</li>
        </ul>
        <p className="mt-2">Both connections can be skipped and done later from Settings.</p>
      </div>

      <div className="flex justify-end">
        <Button onClick={() => onComplete()}>Let&apos;s Get Started →</Button>
      </div>
    </div>
  );
}
