'use client';

import { useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  ChevronRight,
  CreditCard,
  Loader2,
  Mic,
  ShoppingCart,
  Zap,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import {
  createIntentMandate,
  createCartMandate,
  createPaymentMandate,
  type AP2MandateResponse,
} from '@/lib/api/ap2';

// ─── Demo test flow constants ──────────────────────────────────────────────────

const DEMO_CART_ITEMS = [
  { product_id: 'prod-001', name: 'Heavy Duty Drill', quantity: 1, unit_price: 299.0 },
  { product_id: 'prod-002', name: 'Safety Helmet', quantity: 2, unit_price: 45.0 },
];
const DEMO_TOTAL = 389.0;
const DEMO_PAYMENT_METHOD = 'google_pay';

type FlowStep = 'idle' | 'intent' | 'cart' | 'payment' | 'complete' | 'error';

interface FlowState {
  step: FlowStep;
  intentMandate: AP2MandateResponse | null;
  cartMandate: AP2MandateResponse | null;
  paymentMandate: AP2MandateResponse | null;
  error: string | null;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function AP2ConnectionCard() {
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [running, setRunning] = useState(false);
  const [flow, setFlow] = useState<FlowState>({
    step: 'idle',
    intentMandate: null,
    cartMandate: null,
    paymentMandate: null,
    error: null,
  });

  const resetFlow = () => {
    setFlow({
      step: 'idle',
      intentMandate: null,
      cartMandate: null,
      paymentMandate: null,
      error: null,
    });
  };

  const runDemoFlow = async () => {
    setRunning(true);
    setFlow({
      step: 'intent',
      intentMandate: null,
      cartMandate: null,
      paymentMandate: null,
      error: null,
    });

    try {
      // Step 1 — Intent mandate
      const intentMandate = await createIntentMandate('Purchase heavy machinery equipment', 'en', {
        source: 'ccw-erp-demo',
      });
      setFlow((prev) => ({ ...prev, step: 'cart', intentMandate }));

      // Step 2 — Cart mandate
      const cartMandate = await createCartMandate(
        intentMandate.mandate_id,
        DEMO_CART_ITEMS,
        DEMO_TOTAL,
        'AUD'
      );
      setFlow((prev) => ({ ...prev, step: 'payment', cartMandate }));

      // Step 3 — Payment mandate
      const paymentMandate = await createPaymentMandate(
        cartMandate.mandate_id,
        DEMO_TOTAL,
        DEMO_PAYMENT_METHOD,
        'AUD'
      );
      setFlow((prev) => ({ ...prev, step: 'complete', paymentMandate }));

      toast({
        title: 'Demo Flow Complete',
        description: 'All 3 mandates created successfully — Intent → Cart → Payment',
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Demo flow failed';
      setFlow((prev) => ({ ...prev, step: 'error', error: message }));
      toast({
        variant: 'destructive',
        title: 'Flow Failed',
        description: message,
      });
    } finally {
      setRunning(false);
    }
  };

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {/* AP2 / Google Pay icon */}
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-green-500/10">
                <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none">
                  <path
                    d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z"
                    fill="#4285F4"
                  />
                  <path
                    d="M17.5 12c0 3.04-2.46 5.5-5.5 5.5S6.5 15.04 6.5 12 8.96 6.5 12 6.5s5.5 2.46 5.5 5.5z"
                    fill="#fff"
                  />
                  <path
                    d="M12 9.5c-1.38 0-2.5 1.12-2.5 2.5s1.12 2.5 2.5 2.5 2.5-1.12 2.5-2.5-1.12-2.5-2.5-2.5z"
                    fill="#4285F4"
                  />
                </svg>
              </div>
              <div>
                <CardTitle>Google AP2 Payments</CardTitle>
                <CardDescription>
                  Agent Payments Protocol — frictionless AI commerce
                </CardDescription>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="secondary">Demo Mode</Badge>
              <Badge variant="default" className="flex items-center gap-1">
                <CheckCircle2 className="h-3 w-3" />
                Active
              </Badge>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Status banner */}
          <div className="rounded-lg border border-green-200 bg-green-50 p-3 dark:border-green-900 dark:bg-green-950">
            <div className="flex items-start gap-2">
              <CheckCircle2 className="mt-0.5 h-4 w-4 text-green-600 dark:text-green-400" />
              <div className="flex-1">
                <p className="text-sm font-medium text-green-900 dark:text-green-100">
                  AP2 Integration Active
                </p>
                <p className="text-xs text-green-700 dark:text-green-300">
                  Demo mode — 3-step mandate chain ready (Intent → Cart → Payment)
                </p>
              </div>
            </div>
          </div>

          {/* Feature list */}
          <div className="grid grid-cols-2 gap-2">
            {[
              { icon: <Zap className="h-3.5 w-3.5" />, label: 'Mandate chain (3-step)' },
              { icon: <CreditCard className="h-3.5 w-3.5" />, label: 'Google Pay processing' },
              { icon: <Mic className="h-3.5 w-3.5" />, label: 'Voice commerce' },
              { icon: <ShoppingCart className="h-3.5 w-3.5" />, label: 'Agent-to-agent orders' },
            ].map((feat) => (
              <div
                key={feat.label}
                className="text-muted-foreground flex items-center gap-2 rounded-md border px-2 py-1.5 text-xs"
              >
                {feat.icon}
                {feat.label}
              </div>
            ))}
          </div>

          {/* Action buttons */}
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                resetFlow();
                setDialogOpen(true);
              }}
            >
              <Zap className="mr-2 h-4 w-4" />
              Test Payment Flow
            </Button>
          </div>

          {/* Config note */}
          <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-xs text-blue-900 dark:border-blue-900 dark:bg-blue-950 dark:text-blue-100">
            <p className="font-medium">Live mode configuration</p>
            <p className="mt-1 text-blue-700 dark:text-blue-300">
              Set <code className="rounded bg-blue-100 px-1 dark:bg-blue-900">AP2_MODE=live</code>{' '}
              and <code className="rounded bg-blue-100 px-1 dark:bg-blue-900">AP2_API_KEY</code> in
              your environment variables to enable real Google Pay processing.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Demo flow dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>AP2 Demo Payment Flow</DialogTitle>
            <DialogDescription>
              Runs the full 3-step mandate chain in demo mode. No real payment is processed.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Step indicators */}
            <div className="space-y-2">
              {(
                [
                  {
                    id: 'intent',
                    label: 'Step 1 — Intent Mandate',
                    desc: 'Declare purchase intent: "Buy equipment"',
                  },
                  {
                    id: 'cart',
                    label: 'Step 2 — Cart Mandate',
                    desc: `2 items, AUD ${DEMO_TOTAL.toFixed(2)}`,
                  },
                  {
                    id: 'payment',
                    label: 'Step 3 — Payment Mandate',
                    desc: 'Authorise via Google Pay',
                  },
                ] as const
              ).map((step) => {
                const isActive = flow.step === step.id;
                const isComplete =
                  (step.id === 'intent' &&
                    (flow.step === 'cart' ||
                      flow.step === 'payment' ||
                      flow.step === 'complete')) ||
                  (step.id === 'cart' && (flow.step === 'payment' || flow.step === 'complete')) ||
                  (step.id === 'payment' && flow.step === 'complete');
                const isPending =
                  flow.step === 'idle' ||
                  (step.id === 'cart' && flow.step === 'intent') ||
                  (step.id === 'payment' && (flow.step === 'intent' || flow.step === 'cart'));

                return (
                  <div
                    key={step.id}
                    className={`flex items-center gap-3 rounded-lg border p-3 transition-colors ${
                      isComplete
                        ? 'border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-950'
                        : isActive
                          ? 'border-blue-200 bg-blue-50 dark:border-blue-900 dark:bg-blue-950'
                          : 'border-muted bg-muted/30'
                    }`}
                  >
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 border-current">
                      {isComplete ? (
                        <CheckCircle2 className="h-4 w-4 text-green-600" />
                      ) : isActive ? (
                        <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
                      ) : (
                        <ChevronRight className="text-muted-foreground h-3 w-3" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p
                        className={`text-sm font-medium ${
                          isComplete
                            ? 'text-green-900 dark:text-green-100'
                            : isActive
                              ? 'text-blue-900 dark:text-blue-100'
                              : 'text-muted-foreground'
                        }`}
                      >
                        {step.label}
                      </p>
                      <p className="text-muted-foreground truncate text-xs">{step.desc}</p>
                      {isComplete && step.id === 'intent' && flow.intentMandate && (
                        <p className="mt-0.5 truncate font-mono text-xs text-green-700 dark:text-green-300">
                          {flow.intentMandate.mandate_id.slice(0, 18)}…
                        </p>
                      )}
                      {isComplete && step.id === 'cart' && flow.cartMandate && (
                        <p className="mt-0.5 truncate font-mono text-xs text-green-700 dark:text-green-300">
                          {flow.cartMandate.mandate_id.slice(0, 18)}…
                        </p>
                      )}
                      {isComplete && step.id === 'payment' && flow.paymentMandate && (
                        <p className="mt-0.5 truncate font-mono text-xs text-green-700 dark:text-green-300">
                          {flow.paymentMandate.mandate_id.slice(0, 18)}…
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Error state */}
            {flow.step === 'error' && flow.error && (
              <div className="border-destructive/30 bg-destructive/10 flex items-start gap-2 rounded-lg border p-3">
                <AlertCircle className="text-destructive mt-0.5 h-4 w-4 shrink-0" />
                <p className="text-destructive text-sm">{flow.error}</p>
              </div>
            )}

            {/* Complete summary */}
            {flow.step === 'complete' && (
              <div className="rounded-lg border border-green-200 bg-green-50 p-3 dark:border-green-900 dark:bg-green-950">
                <p className="text-sm font-medium text-green-900 dark:text-green-100">
                  Demo flow complete!
                </p>
                <p className="mt-1 text-xs text-green-700 dark:text-green-300">
                  3 mandates created. In live mode this would process a real AUD{' '}
                  {DEMO_TOTAL.toFixed(2)} Google Pay transaction.
                </p>
              </div>
            )}

            {/* Action */}
            <div className="flex gap-2">
              {flow.step === 'idle' || flow.step === 'error' || flow.step === 'complete' ? (
                <Button onClick={runDemoFlow} disabled={running} className="flex-1">
                  {running ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Running…
                    </>
                  ) : flow.step === 'complete' ? (
                    'Run Again'
                  ) : (
                    <>
                      <Zap className="mr-2 h-4 w-4" />
                      Run Demo Flow
                    </>
                  )}
                </Button>
              ) : (
                <Button disabled className="flex-1">
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Running mandate chain…
                </Button>
              )}
              <Button variant="outline" onClick={() => setDialogOpen(false)}>
                Close
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
