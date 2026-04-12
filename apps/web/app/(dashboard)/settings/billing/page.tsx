'use client';

import { useEffect, useState } from 'react';
import { CreditCard, Receipt, RefreshCcw, CheckCircle, AlertCircle, Clock } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { billingApi, type Subscription, type PaymentMethod, type Invoice } from '@/lib/api/billing';

const STATUS_COLORS: Record<string, string> = {
  active: 'bg-green-100 text-green-800',
  trial: 'bg-blue-100 text-blue-800',
  trialing: 'bg-blue-100 text-blue-800',
  past_due: 'bg-red-100 text-red-800',
  canceled: 'bg-gray-100 text-gray-800',
  expired: 'bg-gray-100 text-gray-800',
};

function formatCurrency(cents: number): string {
  return new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency: 'AUD',
  }).format(cents / 100);
}

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-AU', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export default function BillingPage() {
  const { toast } = useToast();
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadBillingData() {
      setLoading(true);
      try {
        const [sub, methods, inv] = await Promise.allSettled([
          billingApi.getSubscription(),
          billingApi.getPaymentMethods(),
          billingApi.getInvoices(),
        ]);
        if (sub.status === 'fulfilled') setSubscription(sub.value);
        if (methods.status === 'fulfilled') setPaymentMethods(methods.value);
        if (inv.status === 'fulfilled') setInvoices(inv.value);
      } catch {
        toast({
          title: 'Error',
          description: 'Failed to load billing data',
          variant: 'destructive',
        });
      } finally {
        setLoading(false);
      }
    }
    loadBillingData();
  }, [toast]);

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <RefreshCcw className="text-muted-foreground h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Billing</h1>
        <p className="text-muted-foreground">
          Manage your subscription, payment methods, and invoices.
        </p>
      </div>

      {/* Subscription Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckCircle className="h-5 w-5" />
            Subscription
          </CardTitle>
          <CardDescription>Your current plan and billing cycle</CardDescription>
        </CardHeader>
        <CardContent>
          {subscription ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-lg font-semibold capitalize">{subscription.tier}</p>
                  <p className="text-muted-foreground text-sm">
                    {subscription.billing_interval === 'annual' ? 'Annual' : 'Monthly'} ·{' '}
                    {subscription.price_display}
                    {subscription.current_period_end && (
                      <> · Renews {formatDate(subscription.current_period_end)}</>
                    )}
                    {subscription.canceled_at && ' · Cancels at period end'}
                  </p>
                </div>
                <Badge
                  className={STATUS_COLORS[subscription.status] ?? 'bg-gray-100 text-gray-800'}
                >
                  {subscription.status.replace('_', ' ')}
                </Badge>
              </div>
              {subscription.status === 'past_due' && (
                <div className="flex items-center gap-2 rounded-md bg-red-50 p-3 text-sm text-red-700">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  Payment overdue — please update your payment method to avoid service interruption.
                </div>
              )}
              {subscription.trial_ends_at && subscription.status === 'trial' && (
                <div className="flex items-center gap-2 rounded-md bg-blue-50 p-3 text-sm text-blue-700">
                  <Clock className="h-4 w-4 shrink-0" />
                  Trial ends {formatDate(subscription.trial_ends_at)}.
                </div>
              )}
            </div>
          ) : (
            <p className="text-muted-foreground text-sm">No active subscription found.</p>
          )}
        </CardContent>
      </Card>

      {/* Payment Methods */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            Payment Methods
          </CardTitle>
          <CardDescription>Cards on file for billing</CardDescription>
        </CardHeader>
        <CardContent>
          {paymentMethods.length === 0 ? (
            <p className="text-muted-foreground text-sm">No payment methods on file.</p>
          ) : (
            <div className="space-y-3">
              {paymentMethods.map((method) => (
                <div
                  key={method.id}
                  className="flex items-center justify-between rounded-md border p-3"
                >
                  <div className="flex items-center gap-3">
                    <CreditCard className="text-muted-foreground h-5 w-5" />
                    <div>
                      <p className="font-medium capitalize">
                        {method.brand} ···· {method.last4}
                      </p>
                      <p className="text-muted-foreground text-xs">
                        Expires {method.exp_month}/{method.exp_year}
                      </p>
                    </div>
                  </div>
                  {method.is_default && <Badge variant="secondary">Default</Badge>}
                </div>
              ))}
            </div>
          )}
          <Separator className="my-4" />
          <p className="text-muted-foreground text-xs">
            To update payment methods, contact support or log in to the Stripe Customer Portal.
          </p>
        </CardContent>
      </Card>

      {/* Invoice History */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Receipt className="h-5 w-5" />
            Invoice History
          </CardTitle>
          <CardDescription>Past invoices and receipts</CardDescription>
        </CardHeader>
        <CardContent>
          {invoices.length === 0 ? (
            <p className="text-muted-foreground text-sm">No invoices yet.</p>
          ) : (
            <div className="space-y-2">
              {invoices.map((invoice) => (
                <div
                  key={invoice.id}
                  className="flex items-center justify-between rounded-md border p-3"
                >
                  <div className="flex items-center gap-3">
                    <Clock className="text-muted-foreground h-4 w-4" />
                    <div>
                      <p className="text-sm font-medium">{invoice.id}</p>
                      <p className="text-muted-foreground text-xs">
                        {formatDate(invoice.created_at)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-semibold">
                      {formatCurrency(invoice.amount_paid)}
                    </span>
                    <Badge
                      variant={invoice.status === 'paid' ? 'default' : 'destructive'}
                      className="text-xs"
                    >
                      {invoice.status}
                    </Badge>
                    {invoice.invoice_pdf && (
                      <Button variant="ghost" size="sm" asChild>
                        <a href={invoice.invoice_pdf} target="_blank" rel="noopener noreferrer">
                          PDF
                        </a>
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
