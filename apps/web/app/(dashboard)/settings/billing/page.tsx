"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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
} from "@/components/ui/alert-dialog";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { CreditCard, Download, Calendar, CheckCircle2, XCircle, Clock, ExternalLink } from "lucide-react";
import { billingApi, type Subscription, type SubscriptionTier, type BillingInterval } from "@/lib/api/billing";
import { billingUsageApi, type UsageMetrics as UsageMetricsType } from "@/lib/api/billing-usage";
import { PlanSelector } from "./components/PlanSelector";
import { UsageMetrics } from "./components/UsageMetrics";
import { PaymentMethodForm } from "./components/PaymentMethodForm";
import { UsageAlerts } from "./components/UsageAlerts";

export default function BillingPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [loading, setLoading] = useState(true);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [currentUsage, setCurrentUsage] = useState<UsageMetricsType | null>(null);
  const [selectedPlan, setSelectedPlan] = useState<{
    tier: SubscriptionTier;
    interval: BillingInterval;
  } | null>(null);
  const [showPaymentForm, setShowPaymentForm] = useState(false);

  useEffect(() => {
    fetchSubscription();
    fetchInvoices();
    fetchUsage();
  }, []);

  async function fetchSubscription() {
    try {
      setLoading(true);
      const data = await billingApi.getSubscription();
      setSubscription(data);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to load subscription",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }

  async function fetchInvoices() {
    try {
      const data = await billingApi.listInvoices(10);
      setInvoices(data);
    } catch (error: any) {
      // Ignore errors for invoices (might not exist yet)
    }
  }

  async function fetchUsage() {
    try {
      const data = await billingUsageApi.getCurrentUsage();
      setCurrentUsage(data);
    } catch (error: any) {
      // Ignore errors for usage (might fail if not yet implemented)
      console.error("Failed to fetch usage:", error);
    }
  }

  async function openCustomerPortal() {
    try {
      const { url } = await billingApi.createPortalSession();
      window.open(url, "_blank");
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to open customer portal",
        variant: "destructive",
      });
    }
  }

  async function handleSelectPlan(tier: SubscriptionTier, interval: BillingInterval) {
    setSelectedPlan({ tier, interval });
    setShowPaymentForm(true);
  }

  async function handleSubmitPayment(paymentMethodId: string) {
    if (!selectedPlan) return;

    try {
      if (subscription?.status === "trial" || !subscription) {
        // Subscribe for the first time
        await billingApi.subscribe({
          tier: selectedPlan.tier,
          billing_interval: selectedPlan.interval,
          payment_method_id: paymentMethodId,
          trial_days: 0,
        });
      } else {
        // Update existing subscription
        await billingApi.updateSubscription({
          tier: selectedPlan.tier,
          billing_interval: selectedPlan.interval,
        });
      }

      toast({
        title: "Success",
        description: "Your subscription has been updated",
      });

      setShowPaymentForm(false);
      setSelectedPlan(null);
      await fetchSubscription();
      router.refresh();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to update subscription",
        variant: "destructive",
      });
    }
  }

  async function handleCancelSubscription(immediately: boolean = false) {
    try {
      await billingApi.cancelSubscription(immediately);

      toast({
        title: "Subscription Canceled",
        description: immediately
          ? "Your subscription has been canceled immediately"
          : "Your subscription will be canceled at the end of the billing period",
      });

      await fetchSubscription();
      router.refresh();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to cancel subscription",
        variant: "destructive",
      });
    }
  }

  function getStatusIcon(status: string) {
    switch (status) {
      case "active":
        return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case "trial":
        return <Clock className="h-4 w-4 text-blue-500" />;
      case "past_due":
      case "canceled":
      case "expired":
        return <XCircle className="h-4 w-4 text-destructive" />;
      default:
        return null;
    }
  }

  function formatDate(dateString: string | null): string {
    if (!dateString) return "N/A";
    return new Date(dateString).toLocaleDateString();
  }

  function formatCurrency(cents: number): string {
    return `$${(cents / 100).toFixed(2)}`;
  }

  if (loading || !subscription) {
    return (
      <div className="flex flex-col gap-6 p-6">
        <div className="text-center">Loading subscription...</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
          <CreditCard className="h-8 w-8" />
          Billing & Subscription
        </h1>
        <p className="text-muted-foreground">
          Manage your subscription, billing, and payment methods
        </p>
      </div>

      {/* Usage Alerts */}
      <UsageAlerts />

      {/* Current Subscription Status */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Current Plan</CardTitle>
              <CardDescription>Your active subscription details</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              {getStatusIcon(subscription.status)}
              <Badge variant={subscription.status === "active" ? "default" : "secondary"}>
                {subscription.status.toUpperCase()}
              </Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div>
              <p className="text-sm text-muted-foreground">Plan</p>
              <p className="text-2xl font-bold capitalize">{subscription.tier}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Billing</p>
              <p className="text-2xl font-bold capitalize">{subscription.billing_interval}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Price</p>
              <p className="text-2xl font-bold">{subscription.price_display}/{subscription.billing_interval === "monthly" ? "mo" : "yr"}</p>
            </div>
          </div>

          <Separator />

          <div className="grid grid-cols-1 gap-2 md:grid-cols-2 text-sm">
            {subscription.trial_ends_at && subscription.status === "trial" && (
              <div>
                <span className="text-muted-foreground">Trial Ends: </span>
                <span className="font-medium">{formatDate(subscription.trial_ends_at)}</span>
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
                <span className="text-muted-foreground">Cancels On: </span>
                <span className="font-medium text-destructive">
                  {formatDate(subscription.canceled_at)}
                </span>
              </div>
            )}
          </div>

          {subscription.status === "active" && !subscription.canceled_at && (
            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={openCustomerPortal}>
                <ExternalLink className="mr-2 h-4 w-4" />
                Manage Billing
              </Button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" size="sm">
                    Cancel Subscription
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Cancel Subscription?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Are you sure you want to cancel your subscription? You will retain access
                      until the end of your current billing period.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Keep Subscription</AlertDialogCancel>
                    <AlertDialogAction onClick={() => handleCancelSubscription(false)}>
                      Cancel at Period End
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Usage Metrics */}
      <div>
        <h2 className="text-xl font-semibold mb-4">Usage & Limits</h2>
        <UsageMetrics
          subscription={subscription}
          currentUsage={
            currentUsage
              ? {
                  locations: currentUsage.locations,
                  users: currentUsage.users,
                  products: currentUsage.products,
                  aiQuotes: currentUsage.ai_quotes,
                }
              : undefined
          }
        />
      </div>

      {/* Available Plans */}
      <div>
        <h2 className="text-xl font-semibold mb-4">Available Plans</h2>
        <PlanSelector
          currentTier={subscription.tier}
          currentInterval={subscription.billing_interval}
          onSelectPlan={handleSelectPlan}
        />
      </div>

      {/* Payment Method Dialog */}
      <Dialog open={showPaymentForm} onOpenChange={setShowPaymentForm}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Update Payment Method</DialogTitle>
            <DialogDescription>
              Add a payment method to subscribe to {selectedPlan?.tier} plan
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

      {/* Invoice History */}
      {invoices.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Invoice History
            </CardTitle>
            <CardDescription>Your recent billing invoices</CardDescription>
          </CardHeader>
          <CardContent>
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
                    <TableCell>{formatDate(invoice.created)}</TableCell>
                    <TableCell className="font-medium">
                      {formatCurrency(invoice.amount_paid)}
                    </TableCell>
                    <TableCell>
                      <Badge variant={invoice.status === "paid" ? "default" : "secondary"}>
                        {invoice.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatDate(invoice.period_start)} - {formatDate(invoice.period_end)}
                    </TableCell>
                    <TableCell className="text-right">
                      {invoice.invoice_pdf && (
                        <Button variant="ghost" size="icon" asChild>
                          <a href={invoice.invoice_pdf} target="_blank" rel="noopener noreferrer">
                            <Download className="h-4 w-4" />
                          </a>
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
