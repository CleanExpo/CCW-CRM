'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import {
  CreditCard,
  Download,
  Calendar,
  CheckCircle2,
  XCircle,
  Clock,
  Trash2,
  Plus,
  ExternalLink,
} from 'lucide-react';
import {
  billingApi,
  type Subscription,
  type SubscriptionTier,
  type BillingInterval,
  type PaymentMethod,
  type Invoice,
} from '@/lib/api/billing';
import { PlanSelector } from './components/PlanSelector';
import { UsageMetrics } from './components/UsageMetrics';
import { PaymentMethodForm } from './components/PaymentMethodForm';
import { ErrorBoundary } from '@/components/errors/ErrorBoundary';

// Demo fallback subscription for when backend is unavailable (demo mode)
const DEMO_SUBSCRIPTION: Subscription = {
  id: 'sub_demo',
  organization_id: 'org_demo',
  tier: 'professional',
  status: 'active',
  billing_interval: 'monthly',
  price_cents: 29900,
  price_display: '$299',
  max_locations: 5,
  max_users: 25,
  max_products: 5000,
  max_ai_quotes_per_month: 500,
  has_multi_location: true,
  has_ai_features: true,
  has_api_access: false,
  has_white_label: false,
  trial_ends_at: null,
  current_period_start: new Date().toISOString(),
  current_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
  canceled_at: null,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

const DEMO_PAYMENT_METHODS: PaymentMethod[] = [
  {
    id: 'pm_demo_1',
    brand: 'visa',
    last4: '4242',
    exp_month: 12,
    exp_year: 2026,
    is_default: true,
  },
];

const DEMO_INVOICES: Invoice[] = [
  {
    id: 'inv_demo_1',
    amount_due: 29900,
    amount_paid: 29900,
    currency: 'usd',
    status: 'paid',
    hosted_invoice_url: null,
    invoice_pdf: null,
    period_start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
    period_end: new Date().toISOString(),
    created_at: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'inv_demo_2',
    amount_due: 29900,
    amount_paid: 29900,
    currency: 'usd',
    status: 'paid',
    hosted_invoice_url: null,
    invoice_pdf: null,
    period_start: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString(),
    period_end: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
    created_at: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString(),
  },
];

function TierBadge({ tier }: { tier: SubscriptionTier }) {
  const config: Record<SubscriptionTier, { label: string; className: string }> = {
    starter: { label: 'Starter', className: 'bg-slate-100 text-slate-800 border-slate-200' },
    professional: { label: 'Professional', className: 'bg-blue-100 text-blue-800 border-blue-200' },
    enterprise: {
      label: 'Enterprise',
      className: 'bg-purple-100 text-purple-800 border-purple-200',
    },
    custom: { label: 'Custom', className: 'bg-amber-100 text-amber-800 border-amber-200' },
  };
  const { label, className } = config[tier];
  return (
    <Badge variant="outline" className={className}>
      {label}
    </Badge>
  );
}

function StatusBadge({ status }: { status: string }) {
  const config: Record<
    string,
    { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }
  > = {
    active: { label: 'Active', variant: 'default' },
    trial: { label: 'Trial', variant: 'secondary' },
    past_due: { label: 'Past Due', variant: 'destructive' },
    canceled: { label: 'Canceled', variant: 'destructive' },
    expired: { label: 'Expired', variant: 'destructive' },
  };
  const { label, variant } = config[status] ?? { label: status, variant: 'secondary' };
  return <Badge variant={variant}>{label}</Badge>;
}

function getStatusIcon(status: string) {
  switch (status) {
    case 'active':
      return <CheckCircle2 className="h-4 w-4 text-green-500" />;
    case 'trial':
      return <Clock className="h-4 w-4 text-blue-500" />;
    case 'past_due':
    case 'canceled':
    case 'expired':
      return <XCircle className="text-destructive h-4 w-4" />;
    default:
      return null;
  }
}

function formatDate(dateString: string | null | undefined): string {
  if (!dateString) return 'N/A';
  return new Date(dateString).toLocaleDateString('en-AU', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function formatCurrency(cents: number, currency: string = 'usd'): string {
  const dollars = cents / 100;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency.toUpperCase(),
  }).format(dollars);
}

function CardBrandIcon({ brand }: { brand: string }) {
  const brands: Record<string, string> = {
    visa: 'VISA',
    mastercard: 'MC',
    amex: 'AMEX',
    discover: 'DISC',
  };
  return (
    <span className="bg-muted inline-flex items-center justify-center rounded border px-1.5 py-0.5 text-xs font-bold tracking-wider uppercase">
      {brands[brand.toLowerCase()] ?? brand.toUpperCase()}
    </span>
  );
}

// Skeleton components for loading state
function CurrentPlanSkeleton() {
  return (
    <Card>
      <CardHeader>
        <Skeleton className="h-6 w-32" />
        <Skeleton className="h-4 w-48" />
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-8 w-24" />
            </div>
          ))}
        </div>
        <Skeleton className="h-px w-full" />
        <div className="grid grid-cols-2 gap-2">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-4 w-40" />
        </div>
      </CardContent>
    </Card>
  );
}

function UsageSkeleton() {
  return (
    <ErrorBoundary>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <Card key={i}>
            <CardHeader className="pb-2">
              <Skeleton className="h-4 w-4" />
              <Skeleton className="h-4 w-24" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-8 w-20" />
              <Skeleton className="mt-2 h-1.5 w-full" />
            </CardContent>
          </Card>
        ))}
      </div>
    </ErrorBoundary>
  );
}

export default function BillingPage() {
  const router = useRouter();
  const { toast } = useToast();

  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCanceling, setIsCanceling] = useState(false);
  const [isRemovingPayment, setIsRemovingPayment] = useState<string | null>(null);

  const [selectedPlan, setSelectedPlan] = useState<{
    tier: SubscriptionTier;
    interval: BillingInterval;
  } | null>(null);
  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const [showAddCard, setShowAddCard] = useState(false);

  useEffect(() => {
    loadAllData();
  }, []);

  async function loadAllData() {
    setLoading(true);
    try {
      // Run all three fetches in parallel, gracefully handle failures with demo fallback
      const [subResult, pmResult, invResult] = await Promise.allSettled([
        billingApi.getSubscription(),
        billingApi.getPaymentMethods(),
        billingApi.getInvoices(10),
      ]);

      if (subResult.status === 'fulfilled') {
        setSubscription(subResult.value);
      } else {
        // Demo fallback when backend unavailable
        setSubscription(DEMO_SUBSCRIPTION);
      }

      if (pmResult.status === 'fulfilled') {
        setPaymentMethods(pmResult.value);
      } else {
        setPaymentMethods(DEMO_PAYMENT_METHODS);
      }

      if (invResult.status === 'fulfilled') {
        setInvoices(invResult.value);
      } else {
        setInvoices(DEMO_INVOICES);
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleSelectPlan(tier: SubscriptionTier, interval: BillingInterval) {
    // If same plan, do nothing
    if (tier === subscription?.tier && interval === subscription?.billing_interval) return;

    setSelectedPlan({ tier, interval });
    if (!subscription || subscription.status === 'trial') {
      // New subscription — need payment method
      setShowPaymentForm(true);
    } else {
      // Update existing subscription with confirmation
      try {
        await billingApi.updateSubscription({ tier, billing_interval: interval });
        toast({
          title: 'Plan Updated',
          description: `Switched to ${tier} (${interval})`,
        });
        await loadAllData();
        router.refresh();
      } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : 'Failed to update plan';
        toast({ title: 'Error', description: msg, variant: 'destructive' });
      } finally {
        setSelectedPlan(null);
      }
    }
  }

  async function handleSubmitPayment(paymentMethodId: string) {
    if (!selectedPlan) return;
    try {
      await billingApi.subscribe({
        tier: selectedPlan.tier,
        billing_interval: selectedPlan.interval,
        payment_method_id: paymentMethodId,
      });
      toast({ title: 'Subscribed', description: 'Your subscription is now active.' });
      setShowPaymentForm(false);
      setSelectedPlan(null);
      await loadAllData();
      router.refresh();
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Failed to subscribe';
      toast({ title: 'Error', description: msg, variant: 'destructive' });
    }
  }

  async function handleCancelSubscription() {
    setIsCanceling(true);
    try {
      await billingApi.cancelSubscription(false);
      toast({
        title: 'Subscription Canceled',
        description: 'Your subscription will be canceled at the end of the billing period.',
      });
      await loadAllData();
      router.refresh();
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Failed to cancel subscription';
      toast({ title: 'Error', description: msg, variant: 'destructive' });
    } finally {
      setIsCanceling(false);
    }
  }

  async function handleAddCard(paymentMethodId: string) {
    try {
      const pm = await billingApi.addPaymentMethod(paymentMethodId);
      setPaymentMethods((prev) => [...prev, pm]);
      setShowAddCard(false);
      toast({ title: 'Card Added', description: 'Payment method saved successfully.' });
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Failed to add payment method';
      toast({ title: 'Error', description: msg, variant: 'destructive' });
    }
  }

  async function handleRemovePaymentMethod(paymentMethodId: string) {
    setIsRemovingPayment(paymentMethodId);
    try {
      await billingApi.removePaymentMethod(paymentMethodId);
      setPaymentMethods((prev) => prev.filter((pm) => pm.id !== paymentMethodId));
      toast({ title: 'Card Removed', description: 'Payment method removed.' });
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Failed to remove payment method';
      toast({ title: 'Error', description: msg, variant: 'destructive' });
    } finally {
      setIsRemovingPayment(null);
    }
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Page Header */}
      <div>
        <h1 className="flex items-center gap-2 text-3xl font-bold tracking-tight">
          <CreditCard className="h-8 w-8" />
          Billing &amp; Subscription
        </h1>
        <p className="text-muted-foreground mt-1">
          Manage your subscription plan, payment methods, and billing history.
        </p>
      </div>

      {/* Current Plan Card */}
      {loading ? (
        <CurrentPlanSkeleton />
      ) : subscription ? (
        <Card>
          <CardHeader>
            <div className="flex items-start justify-between gap-4">
              <div>
                <CardTitle>Current Plan</CardTitle>
                <CardDescription>Your active subscription details</CardDescription>
              </div>
              <div className="flex flex-shrink-0 items-center gap-2">
                {getStatusIcon(subscription.status)}
                <StatusBadge status={subscription.status} />
                <TierBadge tier={subscription.tier} />
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <div>
                <p className="text-muted-foreground text-sm">Plan</p>
                <p className="text-2xl font-bold capitalize">{subscription.tier}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-sm">Billing Cycle</p>
                <p className="text-2xl font-bold capitalize">{subscription.billing_interval}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-sm">Price</p>
                <p className="text-2xl font-bold">
                  {subscription.price_display}/
                  {subscription.billing_interval === 'monthly' ? 'mo' : 'yr'}
                </p>
              </div>
            </div>

            <Separator />

            <div className="grid grid-cols-1 gap-2 text-sm md:grid-cols-3">
              <div>
                <span className="text-muted-foreground">Locations: </span>
                <span className="font-medium">
                  {subscription.max_locations === -1 ? 'Unlimited' : subscription.max_locations}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground">Users: </span>
                <span className="font-medium">
                  {subscription.max_users === -1 ? 'Unlimited' : subscription.max_users}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground">Products: </span>
                <span className="font-medium">
                  {subscription.max_products === -1
                    ? 'Unlimited'
                    : subscription.max_products.toLocaleString()}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-2 text-sm md:grid-cols-3">
              {subscription.trial_ends_at && subscription.status === 'trial' && (
                <div>
                  <span className="text-muted-foreground">Trial Ends: </span>
                  <span className="font-medium text-blue-600">
                    {formatDate(subscription.trial_ends_at)}
                  </span>
                </div>
              )}
              {subscription.current_period_end && (
                <div>
                  <span className="text-muted-foreground">Next Billing: </span>
                  <span className="font-medium">{formatDate(subscription.current_period_end)}</span>
                </div>
              )}
              {subscription.canceled_at && (
                <div>
                  <span className="text-muted-foreground">Cancels: </span>
                  <span className="text-destructive font-medium">
                    {formatDate(subscription.canceled_at)}
                  </span>
                </div>
              )}
            </div>

            {/* Feature flags */}
            <div className="flex flex-wrap gap-2">
              {subscription.has_multi_location && <Badge variant="secondary">Multi-location</Badge>}
              {subscription.has_ai_features && <Badge variant="secondary">AI Features</Badge>}
              {subscription.has_api_access && <Badge variant="secondary">API Access</Badge>}
              {subscription.has_white_label && <Badge variant="secondary">White Label</Badge>}
            </div>

            {/* Action buttons */}
            <div className="flex justify-end gap-2 pt-2">
              {subscription.tier === 'starter' && (
                <Button
                  size="sm"
                  onClick={() => {
                    const plansEl = document.getElementById('available-plans');
                    plansEl?.scrollIntoView({ behavior: 'smooth' });
                  }}
                >
                  Upgrade Plan
                </Button>
              )}
              {subscription.status === 'active' && !subscription.canceled_at && (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="outline" size="sm" disabled={isCanceling}>
                      {isCanceling ? 'Canceling...' : 'Cancel Subscription'}
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Cancel Subscription?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Are you sure you want to cancel your subscription? You will retain full
                        access until <strong>{formatDate(subscription.current_period_end)}</strong>,
                        then your account will be downgraded.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Keep Subscription</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={handleCancelSubscription}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      >
                        Cancel at Period End
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
            </div>
          </CardContent>
        </Card>
      ) : null}

      {/* Usage Metrics */}
      <div>
        <h2 className="mb-4 text-xl font-semibold">Usage &amp; Limits</h2>
        {loading ? (
          <UsageSkeleton />
        ) : subscription ? (
          <UsageMetrics
            subscription={subscription}
            currentUsage={{
              locations: 1,
              users: 2,
              products: 150,
              aiQuotes: 25,
            }}
          />
        ) : null}
      </div>

      {/* Available Plans */}
      <div id="available-plans">
        <h2 className="mb-4 text-xl font-semibold">Available Plans</h2>
        {loading ? (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
            {[0, 1, 2, 3].map((i) => (
              <Card key={i}>
                <CardHeader>
                  <Skeleton className="h-7 w-28" />
                  <Skeleton className="h-4 w-40" />
                </CardHeader>
                <CardContent className="space-y-3">
                  <Skeleton className="h-10 w-24" />
                  {[0, 1, 2, 3].map((j) => (
                    <Skeleton key={j} className="h-4 w-full" />
                  ))}
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <PlanSelector
            currentTier={subscription?.tier}
            currentInterval={subscription?.billing_interval}
            onSelectPlan={handleSelectPlan}
          />
        )}
      </div>

      {/* Payment Method Flow Dialog */}
      <Dialog open={showPaymentForm} onOpenChange={setShowPaymentForm}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Add Payment Method to Subscribe</DialogTitle>
            <DialogDescription>
              Enter your card details to activate the{' '}
              <strong className="capitalize">{selectedPlan?.tier}</strong> plan (
              {selectedPlan?.interval}).
            </DialogDescription>
          </DialogHeader>
          <PaymentMethodForm
            onSubmit={handleSubmitPayment}
            onCancel={() => {
              setShowPaymentForm(false);
              setSelectedPlan(null);
            }}
          />
        </DialogContent>
      </Dialog>

      {/* Payment Methods Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="h-5 w-5" />
                Payment Methods
              </CardTitle>
              <CardDescription>Cards on file for billing</CardDescription>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setShowAddCard(true)}
              className="flex items-center gap-1"
            >
              <Plus className="h-4 w-4" />
              Add Card
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              {[0, 1].map((i) => (
                <div key={i} className="flex items-center justify-between rounded-lg border p-3">
                  <div className="flex items-center gap-3">
                    <Skeleton className="h-6 w-12" />
                    <Skeleton className="h-4 w-32" />
                  </div>
                  <Skeleton className="h-8 w-8" />
                </div>
              ))}
            </div>
          ) : paymentMethods.length === 0 ? (
            <div className="rounded-lg border border-dashed p-6 text-center">
              <CreditCard className="text-muted-foreground mx-auto mb-2 h-8 w-8" />
              <p className="text-muted-foreground text-sm">No payment methods on file.</p>
              <Button
                size="sm"
                variant="outline"
                className="mt-3"
                onClick={() => setShowAddCard(true)}
              >
                <Plus className="mr-1 h-4 w-4" />
                Add a Card
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              {paymentMethods.map((pm) => (
                <div
                  key={pm.id}
                  className="bg-card flex items-center justify-between rounded-lg border p-3"
                >
                  <div className="flex items-center gap-3">
                    <CardBrandIcon brand={pm.brand} />
                    <div>
                      <p className="text-sm font-medium">
                        **** **** **** {pm.last4}
                        {pm.is_default && (
                          <Badge variant="secondary" className="ml-2 text-xs">
                            Default
                          </Badge>
                        )}
                      </p>
                      <p className="text-muted-foreground text-xs">
                        Expires {pm.exp_month.toString().padStart(2, '0')}/{pm.exp_year}
                      </p>
                    </div>
                  </div>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-muted-foreground hover:text-destructive"
                        disabled={isRemovingPayment === pm.id}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Remove Payment Method?</AlertDialogTitle>
                        <AlertDialogDescription>
                          Are you sure you want to remove the{' '}
                          <strong>
                            {pm.brand} ending in {pm.last4}
                          </strong>
                          ? This action cannot be undone.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Keep Card</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => handleRemovePaymentMethod(pm.id)}
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                          Remove
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add Card Dialog */}
      <Dialog open={showAddCard} onOpenChange={setShowAddCard}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Add Payment Method</DialogTitle>
            <DialogDescription>
              Your payment information is securely processed by Stripe.
            </DialogDescription>
          </DialogHeader>
          <PaymentMethodForm onSubmit={handleAddCard} onCancel={() => setShowAddCard(false)} />
        </DialogContent>
      </Dialog>

      {/* Invoice History */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Invoice History
          </CardTitle>
          <CardDescription>Your recent billing invoices</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-2">
              {[0, 1, 2].map((i) => (
                <div key={i} className="flex items-center gap-4 border-b py-3 last:border-0">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-4 w-16" />
                  <Skeleton className="h-5 w-12" />
                  <Skeleton className="ml-auto h-4 w-40" />
                </div>
              ))}
            </div>
          ) : invoices.length === 0 ? (
            <div className="rounded-lg border border-dashed p-6 text-center">
              <Calendar className="text-muted-foreground mx-auto mb-2 h-8 w-8" />
              <p className="text-muted-foreground text-sm">No invoices yet.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Period</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invoices.map((invoice) => (
                  <TableRow key={invoice.id}>
                    <TableCell className="text-sm">{formatDate(invoice.created_at)}</TableCell>
                    <TableCell className="font-medium">
                      {formatCurrency(invoice.amount_paid, invoice.currency)}
                    </TableCell>
                    <TableCell>
                      <Badge variant={invoice.status === 'paid' ? 'default' : 'secondary'}>
                        {invoice.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {formatDate(invoice.period_start)} &ndash; {formatDate(invoice.period_end)}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        {invoice.hosted_invoice_url && (
                          <Button variant="ghost" size="icon" asChild>
                            <a
                              href={invoice.hosted_invoice_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              title="View Invoice"
                            >
                              <ExternalLink className="h-4 w-4" />
                            </a>
                          </Button>
                        )}
                        {invoice.invoice_pdf && (
                          <Button variant="ghost" size="icon" asChild>
                            <a
                              href={invoice.invoice_pdf}
                              target="_blank"
                              rel="noopener noreferrer"
                              title="Download PDF"
                            >
                              <Download className="h-4 w-4" />
                            </a>
                          </Button>
                        )}
                        {!invoice.hosted_invoice_url && !invoice.invoice_pdf && (
                          <span className="text-muted-foreground text-xs">—</span>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
