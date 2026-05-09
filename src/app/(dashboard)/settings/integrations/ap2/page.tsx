'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  ChevronRight,
  Clock,
  CreditCard,
  Loader2,
  Mic,
  RefreshCw,
  XCircle,
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
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import {
  createCartMandate,
  createIntentMandate,
  createPaymentMandate,
  createVoiceSession,
  listMandates,
  listTransactions,
  type AP2MandateListItem,
  type AP2MandateResponse,
  type AP2TransactionListItem,
} from '@/lib/api/ap2';
import { ErrorBoundary } from '@/components/errors/ErrorBoundary';

// ─── Demo fallback data ────────────────────────────────────────────────────────

const DEMO_TRANSACTIONS: AP2TransactionListItem[] = [
  {
    transaction_id: 'txn-demo-001',
    mandate_id: 'mnd-demo-pay-001',
    status: 'completed',
    amount: 389.0,
    currency: 'AUD',
    payment_method: 'google_pay',
    completed_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    failed_at: null,
    error_message: null,
    created_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
  },
  {
    transaction_id: 'txn-demo-002',
    mandate_id: 'mnd-demo-pay-002',
    status: 'completed',
    amount: 1250.0,
    currency: 'AUD',
    payment_method: 'google_pay',
    completed_at: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
    failed_at: null,
    error_message: null,
    created_at: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    transaction_id: 'txn-demo-003',
    mandate_id: 'mnd-demo-pay-003',
    status: 'failed',
    amount: 475.0,
    currency: 'AUD',
    payment_method: 'google_pay',
    completed_at: null,
    failed_at: new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString(),
    error_message: 'Mandate expired before execution',
    created_at: new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString(),
  },
];

const DEMO_MANDATES: AP2MandateListItem[] = [
  {
    mandate_id: 'mnd-demo-pay-001',
    mandate_type: 'payment',
    status: 'executed',
    expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    parent_mandate_id: 'mnd-demo-crt-001',
    payment_amount: 389.0,
    payment_currency: 'AUD',
    created_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
  },
  {
    mandate_id: 'mnd-demo-crt-001',
    mandate_type: 'cart',
    status: 'executed',
    expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    parent_mandate_id: 'mnd-demo-int-001',
    payment_amount: null,
    payment_currency: null,
    created_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
  },
  {
    mandate_id: 'mnd-demo-int-001',
    mandate_type: 'intent',
    status: 'executed',
    expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    parent_mandate_id: null,
    payment_amount: null,
    payment_currency: null,
    created_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
  },
];

// ─── Constants for the payment wizard ─────────────────────────────────────────

const DEMO_CART_ITEMS = [
  { product_id: 'prod-001', name: 'Heavy Duty Drill', quantity: 1, unit_price: 299.0 },
  { product_id: 'prod-002', name: 'Safety Helmet', quantity: 2, unit_price: 45.0 },
];
const DEMO_TOTAL = 389.0;

// ─── Helper utilities ──────────────────────────────────────────────────────────

function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-AU', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatAUD(amount: number, currency = 'AUD'): string {
  return new Intl.NumberFormat('en-AU', { style: 'currency', currency }).format(amount);
}

function truncate(id: string, chars = 16): string {
  return id.length > chars ? `${id.slice(0, chars)}…` : id;
}

// ─── Badge helpers ─────────────────────────────────────────────────────────────

function TransactionStatusBadge({ status }: { status: AP2TransactionListItem['status'] }) {
  const map: Record<
    AP2TransactionListItem['status'],
    { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }
  > = {
    completed: { label: 'Completed', variant: 'default' },
    pending: { label: 'Pending', variant: 'secondary' },
    failed: { label: 'Failed', variant: 'destructive' },
    refunded: { label: 'Refunded', variant: 'outline' },
  };
  const { label, variant } = map[status] ?? { label: status, variant: 'secondary' };
  return <Badge variant={variant}>{label}</Badge>;
}

function MandateTypeBadge({ type }: { type: AP2MandateListItem['mandate_type'] }) {
  const map: Record<AP2MandateListItem['mandate_type'], { label: string; className: string }> = {
    intent: { label: 'INTENT', className: 'bg-blue-100 text-blue-800 border-blue-200' },
    cart: { label: 'CART', className: 'bg-amber-100 text-amber-800 border-amber-200' },
    payment: { label: 'PAYMENT', className: 'bg-green-100 text-green-800 border-green-200' },
  };
  const { label, className } = map[type] ?? { label: type.toUpperCase(), className: '' };
  return (
    <Badge variant="outline" className={className}>
      {label}
    </Badge>
  );
}

function MandateStatusBadge({ status }: { status: AP2MandateListItem['status'] }) {
  const map: Record<
    AP2MandateListItem['status'],
    { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }
  > = {
    verified: { label: 'Verified', variant: 'default' },
    executed: { label: 'Executed', variant: 'secondary' },
    pending: { label: 'Pending', variant: 'secondary' },
    expired: { label: 'Expired', variant: 'outline' },
    failed: { label: 'Failed', variant: 'destructive' },
  };
  const { label, variant } = map[status] ?? { label: status, variant: 'secondary' };
  return <Badge variant={variant}>{label}</Badge>;
}

// ─── Payment wizard ────────────────────────────────────────────────────────────

type WizardStep = 'idle' | 'intent' | 'cart' | 'payment' | 'complete' | 'error';

interface WizardState {
  step: WizardStep;
  intentMandate: AP2MandateResponse | null;
  cartMandate: AP2MandateResponse | null;
  paymentMandate: AP2MandateResponse | null;
  error: string | null;
}

const WIZARD_INITIAL: WizardState = {
  step: 'idle',
  intentMandate: null,
  cartMandate: null,
  paymentMandate: null,
  error: null,
};

function PaymentWizard({
  open,
  onOpenChange,
  onComplete,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onComplete: () => void;
}) {
  const { toast } = useToast();
  const [running, setRunning] = useState(false);
  const [wizard, setWizard] = useState<WizardState>(WIZARD_INITIAL);

  const reset = () => setWizard(WIZARD_INITIAL);

  const run = async () => {
    setRunning(true);
    setWizard({
      step: 'intent',
      intentMandate: null,
      cartMandate: null,
      paymentMandate: null,
      error: null,
    });

    try {
      const intentMandate = await createIntentMandate('Purchase heavy machinery equipment', 'en', {
        source: 'ccw-erp-ap2-dashboard',
      });
      setWizard((p) => ({ ...p, step: 'cart', intentMandate }));

      const cartMandate = await createCartMandate(
        intentMandate.mandate_id,
        DEMO_CART_ITEMS,
        DEMO_TOTAL,
        'AUD'
      );
      setWizard((p) => ({ ...p, step: 'payment', cartMandate }));

      const paymentMandate = await createPaymentMandate(
        cartMandate.mandate_id,
        DEMO_TOTAL,
        'google_pay',
        'AUD'
      );
      setWizard((p) => ({ ...p, step: 'complete', paymentMandate }));

      toast({
        title: 'Payment mandate created',
        description: 'Full mandate chain complete — ready for execution.',
      });
      onComplete();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Payment flow failed';
      setWizard((p) => ({ ...p, step: 'error', error: msg }));
      toast({ variant: 'destructive', title: 'Flow failed', description: msg });
    } finally {
      setRunning(false);
    }
  };

  const STEPS = [
    { id: 'intent' as const, label: 'Step 1 — Intent Mandate', desc: 'Declare purchase intent' },
    {
      id: 'cart' as const,
      label: 'Step 2 — Cart Mandate',
      desc: `2 items · AUD ${DEMO_TOTAL.toFixed(2)}`,
    },
    { id: 'payment' as const, label: 'Step 3 — Payment Mandate', desc: 'Authorise via Google Pay' },
  ];

  const stepDone = (id: WizardState['step']) => {
    const order: WizardStep[] = ['idle', 'intent', 'cart', 'payment', 'complete', 'error'];
    const current = order.indexOf(wizard.step);
    const target = order.indexOf(id);
    return current > target && wizard.step !== 'error';
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>New AP2 Payment</DialogTitle>
          <DialogDescription>
            Runs the 3-step mandate chain (Intent → Cart → Payment) in demo mode.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {STEPS.map((s) => {
            const isActive = wizard.step === s.id;
            const isComplete = stepDone(s.id);
            const isPending =
              wizard.step === 'idle' ||
              (s.id === 'cart' && wizard.step === 'intent') ||
              (s.id === 'payment' && (wizard.step === 'intent' || wizard.step === 'cart'));

            return (
              <div
                key={s.id}
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
                    {s.label}
                  </p>
                  <p className="text-muted-foreground truncate text-xs">{s.desc}</p>
                </div>
              </div>
            );
          })}

          {wizard.step === 'error' && wizard.error && (
            <div className="border-destructive/30 bg-destructive/10 flex items-start gap-2 rounded-lg border p-3">
              <AlertCircle className="text-destructive mt-0.5 h-4 w-4 shrink-0" />
              <p className="text-destructive text-sm">{wizard.error}</p>
            </div>
          )}

          {wizard.step === 'complete' && (
            <div className="rounded-lg border border-green-200 bg-green-50 p-3 dark:border-green-900 dark:bg-green-950">
              <p className="text-sm font-medium text-green-900 dark:text-green-100">
                Mandate chain complete!
              </p>
              <p className="mt-1 text-xs text-green-700 dark:text-green-300">
                Payment mandate ID:{' '}
                <span className="font-mono">
                  {truncate(wizard.paymentMandate?.mandate_id ?? '', 20)}
                </span>
              </p>
            </div>
          )}

          <div className="flex gap-2">
            {wizard.step === 'idle' || wizard.step === 'error' || wizard.step === 'complete' ? (
              <Button onClick={run} disabled={running} className="flex-1">
                {running ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Running…
                  </>
                ) : wizard.step === 'complete' ? (
                  'Run Again'
                ) : (
                  <>
                    <Zap className="mr-2 h-4 w-4" />
                    Run Payment Flow
                  </>
                )}
              </Button>
            ) : (
              <Button disabled className="flex-1">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Processing…
              </Button>
            )}
            <Button
              variant="outline"
              onClick={() => {
                reset();
                onOpenChange(false);
              }}
            >
              Close
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Skeleton loaders ──────────────────────────────────────────────────────────

function TableSkeleton({ rows = 4, cols = 4 }: { rows?: number; cols?: number }) {
  return (
    <ErrorBoundary>
      <div className="space-y-2">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex gap-4">
            {Array.from({ length: cols }).map((_, j) => (
              <Skeleton key={j} className="h-4 flex-1" />
            ))}
          </div>
        ))}
      </div>
    </ErrorBoundary>
  );
}

// ─── Main page ─────────────────────────────────────────────────────────────────

export default function AP2PaymentsPage() {
  const { toast } = useToast();

  const [transactions, setTransactions] = useState<AP2TransactionListItem[]>([]);
  const [mandates, setMandates] = useState<AP2MandateListItem[]>([]);
  const [voiceSessionCount, setVoiceSessionCount] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [wizardOpen, setWizardOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [txResult, mnResult] = await Promise.allSettled([
        listTransactions(1, 10),
        listMandates(1, 20),
      ]);

      setTransactions(txResult.status === 'fulfilled' ? txResult.value.items : DEMO_TRANSACTIONS);
      setMandates(mnResult.status === 'fulfilled' ? mnResult.value.items : DEMO_MANDATES);
    } catch {
      setTransactions(DEMO_TRANSACTIONS);
      setMandates(DEMO_MANDATES);
      toast({
        variant: 'destructive',
        title: 'Using demo data',
        description: 'Could not reach AP2 backend.',
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    load();
  }, [load]);

  // Stats derived from data
  const completedCount = transactions.filter((t) => t.status === 'completed').length;
  const totalVolume = transactions
    .filter((t) => t.status === 'completed')
    .reduce((sum, t) => sum + t.amount, 0);
  const activeMandate = mandates.filter(
    (m) => m.status === 'verified' || m.status === 'pending'
  ).length;

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Breadcrumb header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/settings?panel=integrations">
              <ArrowLeft className="mr-1 h-4 w-4" />
              Integrations
            </Link>
          </Button>
          <span className="text-muted-foreground">/</span>
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-green-500/10">
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none">
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
            <h1 className="text-2xl font-bold tracking-tight">Google AP2 Payments</h1>
          </div>
          <Badge variant="secondary">Demo Mode</Badge>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button size="sm" onClick={() => setWizardOpen(true)}>
            <Zap className="mr-2 h-4 w-4" />
            New Payment
          </Button>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {[
          {
            icon: <CheckCircle2 className="h-5 w-5 text-green-500" />,
            label: 'Completed',
            value: loading ? null : completedCount,
          },
          {
            icon: <CreditCard className="h-5 w-5 text-blue-500" />,
            label: 'Total Volume',
            value: loading ? null : formatAUD(totalVolume),
          },
          {
            icon: <Clock className="h-5 w-5 text-amber-500" />,
            label: 'Active Mandates',
            value: loading ? null : activeMandate,
          },
          {
            icon: <Mic className="h-5 w-5 text-purple-500" />,
            label: 'Voice Sessions',
            value: loading ? null : voiceSessionCount,
          },
        ].map((stat) => (
          <Card key={stat.label}>
            <CardContent className="flex items-center gap-3 pt-5">
              {stat.icon}
              <div>
                <p className="text-muted-foreground text-xs">{stat.label}</p>
                {stat.value === null ? (
                  <Skeleton className="mt-1 h-6 w-12" />
                ) : (
                  <p className="text-lg font-bold">{stat.value}</p>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Transactions table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            Transaction History
          </CardTitle>
          <CardDescription>Recent AP2 payment executions</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <TableSkeleton rows={3} cols={5} />
          ) : transactions.length === 0 ? (
            <div className="rounded-lg border border-dashed p-8 text-center">
              <CreditCard className="text-muted-foreground mx-auto mb-2 h-8 w-8" />
              <p className="text-muted-foreground text-sm">No transactions yet.</p>
              <Button
                size="sm"
                variant="outline"
                className="mt-3"
                onClick={() => setWizardOpen(true)}
              >
                <Zap className="mr-1 h-4 w-4" />
                Create First Payment
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Transaction ID</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Method</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Completed</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transactions.map((tx) => (
                  <TableRow key={tx.transaction_id}>
                    <TableCell className="text-muted-foreground font-mono text-xs">
                      {truncate(tx.transaction_id)}
                    </TableCell>
                    <TableCell className="font-medium">
                      {formatAUD(tx.amount, tx.currency)}
                    </TableCell>
                    <TableCell className="text-sm capitalize">
                      {tx.payment_method?.replace('_', ' ') ?? '—'}
                    </TableCell>
                    <TableCell>
                      <TransactionStatusBadge status={tx.status} />
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {formatDate(tx.completed_at ?? tx.failed_at)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Mandate chain table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5" />
            Mandate Chain
          </CardTitle>
          <CardDescription>Recent mandate records (Intent → Cart → Payment)</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <TableSkeleton rows={4} cols={5} />
          ) : mandates.length === 0 ? (
            <div className="rounded-lg border border-dashed p-8 text-center">
              <Zap className="text-muted-foreground mx-auto mb-2 h-8 w-8" />
              <p className="text-muted-foreground text-sm">No mandates created yet.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Mandate ID</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {mandates.map((m) => (
                  <TableRow key={m.mandate_id}>
                    <TableCell>
                      <span className="text-muted-foreground font-mono text-xs">
                        {truncate(m.mandate_id)}
                      </span>
                      {m.parent_mandate_id && (
                        <span className="text-muted-foreground ml-2 text-xs">↳ child</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <MandateTypeBadge type={m.mandate_type} />
                    </TableCell>
                    <TableCell>
                      <MandateStatusBadge status={m.status} />
                    </TableCell>
                    <TableCell className="text-sm">
                      {m.payment_amount != null
                        ? formatAUD(m.payment_amount, m.payment_currency ?? 'AUD')
                        : '—'}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {formatDate(m.created_at)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Voice Commerce card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mic className="h-5 w-5" />
            Voice Commerce
          </CardTitle>
          <CardDescription>Agent-driven voice payment sessions</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm dark:border-blue-900 dark:bg-blue-950">
            <p className="font-medium text-blue-900 dark:text-blue-100">
              Voice sessions are processed server-side
            </p>
            <p className="mt-1 text-xs text-blue-700 dark:text-blue-300">
              AP2 voice commerce sessions are created by AI agents and Google Assistant
              integrations. Session history is available via the AP2 backend API.
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={async () => {
              try {
                const session = await createVoiceSession('en');
                toast({
                  title: 'Voice session created',
                  description: `Session ID: ${truncate(session.session_id, 20)}`,
                });
                setVoiceSessionCount((n) => n + 1);
              } catch {
                toast({
                  variant: 'destructive',
                  title: 'Failed to create session',
                  description: 'Check that the AP2 backend is running.',
                });
              }
            }}
          >
            <Mic className="mr-2 h-4 w-4" />
            Start Voice Session
          </Button>
        </CardContent>
      </Card>

      {/* Config card */}
      <Card>
        <CardHeader>
          <CardTitle>Configuration</CardTitle>
          <CardDescription>Environment variables for live mode</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="bg-muted/50 space-y-2 rounded-lg p-4 font-mono text-sm">
            {[
              ['AP2_MODE', 'live'],
              ['AP2_API_KEY', 'your-google-ap2-key'],
              ['AP2_WEBHOOK_SECRET', 'your-webhook-secret'],
              ['AP2_SIGNATURE_VERIFICATION_ENABLED', 'true'],
            ].map(([key, val]) => (
              <div key={key} className="flex gap-2">
                <span className="text-blue-600 dark:text-blue-400">{key}</span>
                <span className="text-muted-foreground">=</span>
                <span className="text-green-700 dark:text-green-400">{val}</span>
              </div>
            ))}
          </div>
          <p className="text-muted-foreground mt-3 text-xs">
            Set these in your <code className="bg-muted rounded px-1">.env</code> file or Vercel
            environment settings to switch from demo to live Google Pay processing.
          </p>
        </CardContent>
      </Card>

      {/* Payment wizard dialog */}
      <PaymentWizard open={wizardOpen} onOpenChange={setWizardOpen} onComplete={load} />
    </div>
  );
}
