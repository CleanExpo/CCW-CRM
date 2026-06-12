import { prisma } from '@/lib/db/prisma';
import type {
  BillingInterval,
  Invoice,
  PaymentMethod,
  SubscribeRequest,
  Subscription,
  SubscriptionStatus,
  SubscriptionTier,
  UpdateSubscriptionRequest,
} from '@/lib/api/billing';

const TIER_PRICING: Record<
  SubscriptionTier,
  { monthly: number; annual: number; max_locations: number; max_users: number; max_products: number; max_ai_quotes_per_month: number; has_multi_location: boolean; has_ai_features: boolean; has_api_access: boolean; has_white_label: boolean }
> = {
  starter: {
    monthly: 9900,
    annual: 99000,
    max_locations: 1,
    max_users: 3,
    max_products: 500,
    max_ai_quotes_per_month: 50,
    has_multi_location: false,
    has_ai_features: false,
    has_api_access: false,
    has_white_label: false,
  },
  professional: {
    monthly: 24900,
    annual: 249000,
    max_locations: 5,
    max_users: 15,
    max_products: 5000,
    max_ai_quotes_per_month: 500,
    has_multi_location: true,
    has_ai_features: true,
    has_api_access: false,
    has_white_label: false,
  },
  enterprise: {
    monthly: 49900,
    annual: 499000,
    max_locations: 50,
    max_users: 100,
    max_products: 50000,
    max_ai_quotes_per_month: 5000,
    has_multi_location: true,
    has_ai_features: true,
    has_api_access: true,
    has_white_label: false,
  },
  custom: {
    monthly: 0,
    annual: 0,
    max_locations: 999,
    max_users: 999,
    max_products: 999999,
    max_ai_quotes_per_month: 99999,
    has_multi_location: true,
    has_ai_features: true,
    has_api_access: true,
    has_white_label: true,
  },
};

export const PAYMENT_METHOD_TYPES = [
  'card',
  'bank_account',
  'direct_debit',
  'invoice',
] as const;

function formatPrice(cents: number): string {
  return new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(
    cents / 100
  );
}

function addMonths(date: Date, months: number): Date {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d;
}

function serializeSubscription(
  row: {
    id: string;
    workspaceId: string;
    tier: string;
    status: string;
    billingInterval: string;
    priceCents: number;
    trialEndsAt: Date | null;
    currentPeriodStart: Date | null;
    currentPeriodEnd: Date | null;
    canceledAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
  },
  tier: SubscriptionTier
): Subscription {
  const pricing = TIER_PRICING[tier];
  return {
    id: row.id,
    organization_id: row.workspaceId,
    tier,
    status: row.status as SubscriptionStatus,
    billing_interval: row.billingInterval as BillingInterval,
    price_cents: row.priceCents,
    price_display: formatPrice(row.priceCents),
    max_locations: pricing.max_locations,
    max_users: pricing.max_users,
    max_products: pricing.max_products,
    max_ai_quotes_per_month: pricing.max_ai_quotes_per_month,
    has_multi_location: pricing.has_multi_location,
    has_ai_features: pricing.has_ai_features,
    has_api_access: pricing.has_api_access,
    has_white_label: pricing.has_white_label,
    trial_ends_at: row.trialEndsAt?.toISOString() ?? null,
    current_period_start: row.currentPeriodStart?.toISOString() ?? null,
    current_period_end: row.currentPeriodEnd?.toISOString() ?? null,
    canceled_at: row.canceledAt?.toISOString() ?? null,
    created_at: row.createdAt.toISOString(),
    updated_at: row.updatedAt.toISOString(),
  };
}

async function ensureSubscription(workspaceId: string) {
  const existing = await prisma.workspaceSubscription.findUnique({ where: { workspaceId } });
  if (existing) return existing;

  const now = new Date();
  const trialEnds = addMonths(now, 1);
  return prisma.workspaceSubscription.create({
    data: {
      workspaceId,
      tier: 'professional',
      status: 'trial',
      billingInterval: 'monthly',
      priceCents: TIER_PRICING.professional.monthly,
      trialEndsAt: trialEnds,
      currentPeriodStart: now,
      currentPeriodEnd: trialEnds,
    },
  });
}

export async function getWorkspaceSubscription(workspaceId: string): Promise<Subscription> {
  const row = await ensureSubscription(workspaceId);
  return serializeSubscription(row, row.tier as SubscriptionTier);
}

export async function subscribeWorkspace(
  workspaceId: string,
  data: SubscribeRequest
): Promise<Subscription> {
  const tier = data.tier;
  const interval = data.billing_interval;
  const priceCents = TIER_PRICING[tier][interval];
  const now = new Date();
  const periodEnd = interval === 'annual' ? addMonths(now, 12) : addMonths(now, 1);
  const trialDays = data.trial_days ?? 0;

  const row = await prisma.workspaceSubscription.upsert({
    where: { workspaceId },
    create: {
      workspaceId,
      tier,
      status: trialDays > 0 ? 'trial' : 'active',
      billingInterval: interval,
      priceCents,
      trialEndsAt: trialDays > 0 ? new Date(now.getTime() + trialDays * 86400000) : null,
      currentPeriodStart: now,
      currentPeriodEnd: periodEnd,
    },
    update: {
      tier,
      status: trialDays > 0 ? 'trial' : 'active',
      billingInterval: interval,
      priceCents,
      canceledAt: null,
      currentPeriodStart: now,
      currentPeriodEnd: periodEnd,
    },
  });

  if (data.payment_method_id) {
    await addWorkspacePaymentMethod(workspaceId, data.payment_method_id);
  }

  return serializeSubscription(row, tier);
}

export async function updateWorkspaceSubscription(
  workspaceId: string,
  data: UpdateSubscriptionRequest
): Promise<Subscription> {
  const existing = await ensureSubscription(workspaceId);
  const tier = (data.tier ?? existing.tier) as SubscriptionTier;
  const interval = (data.billing_interval ?? existing.billingInterval) as BillingInterval;
  const priceCents = TIER_PRICING[tier][interval];

  const row = await prisma.workspaceSubscription.update({
    where: { workspaceId },
    data: {
      tier,
      billingInterval: interval,
      priceCents,
      status: existing.status === 'canceled' ? 'active' : existing.status,
      canceledAt: existing.status === 'canceled' ? null : existing.canceledAt,
    },
  });

  return serializeSubscription(row, tier);
}

export async function cancelWorkspaceSubscription(
  workspaceId: string,
  immediately: boolean
): Promise<void> {
  const existing = await ensureSubscription(workspaceId);
  await prisma.workspaceSubscription.update({
    where: { workspaceId },
    data: {
      status: immediately ? 'canceled' : existing.status,
      canceledAt: new Date(),
      currentPeriodEnd: immediately ? new Date() : existing.currentPeriodEnd,
    },
  });
}

export async function listWorkspacePaymentMethods(workspaceId: string): Promise<PaymentMethod[]> {
  await ensureSubscription(workspaceId);
  const rows = await prisma.workspacePaymentMethod.findMany({
    where: { workspaceId },
    orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
  });
  return rows.map((r) => ({
    id: r.id,
    brand: r.brand,
    last4: r.last4,
    exp_month: r.expMonth,
    exp_year: r.expYear,
    is_default: r.isDefault,
  }));
}

function parsePaymentMethodStub(paymentMethodId: string): {
  brand: string;
  last4: string;
  exp_month: number;
  exp_year: number;
} {
  const digits = paymentMethodId.replace(/\D/g, '');
  const last4 = digits.slice(-4).padStart(4, '0');
  const brand = paymentMethodId.toLowerCase().includes('amex') ? 'amex' : 'visa';
  const now = new Date();
  return {
    brand,
    last4,
    exp_month: (now.getMonth() + 1) % 12 || 12,
    exp_year: now.getFullYear() + 3,
  };
}

export async function addWorkspacePaymentMethod(
  workspaceId: string,
  paymentMethodId: string
): Promise<PaymentMethod> {
  await ensureSubscription(workspaceId);
  const parsed = parsePaymentMethodStub(paymentMethodId);

  await prisma.workspacePaymentMethod.updateMany({
    where: { workspaceId },
    data: { isDefault: false },
  });

  const row = await prisma.workspacePaymentMethod.create({
    data: {
      workspaceId,
      brand: parsed.brand,
      last4: parsed.last4,
      expMonth: parsed.exp_month,
      expYear: parsed.exp_year,
      isDefault: true,
      externalId: paymentMethodId,
    },
  });

  await prisma.workspaceSubscription.update({
    where: { workspaceId },
    data: { status: 'active', lastPaymentFailedAt: null },
  });

  return {
    id: row.id,
    brand: row.brand,
    last4: row.last4,
    exp_month: row.expMonth,
    exp_year: row.expYear,
    is_default: row.isDefault,
  };
}

export async function removeWorkspacePaymentMethod(
  workspaceId: string,
  paymentMethodId: string
): Promise<void> {
  await prisma.workspacePaymentMethod.deleteMany({
    where: { workspaceId, id: paymentMethodId },
  });
}

export async function listWorkspaceBillingInvoices(
  workspaceId: string,
  limit: number
): Promise<Invoice[]> {
  await ensureSubscription(workspaceId);
  const rows = await prisma.workspaceBillingInvoice.findMany({
    where: { workspaceId },
    orderBy: { createdAt: 'desc' },
    take: limit,
  });
  return rows.map((r) => ({
    id: r.id,
    amount_due: r.amountDue,
    amount_paid: r.amountPaid,
    currency: r.currency,
    status: r.status,
    hosted_invoice_url: r.hostedInvoiceUrl,
    invoice_pdf: r.invoicePdf,
    period_start: r.periodStart?.toISOString() ?? null,
    period_end: r.periodEnd?.toISOString() ?? null,
    created_at: r.createdAt.toISOString(),
  }));
}

export async function getSubscriptionHealth(workspaceId: string) {
  const sub = await ensureSubscription(workspaceId);
  const methods = await prisma.workspacePaymentMethod.count({ where: { workspaceId } });
  const openInvoices = await prisma.workspaceBillingInvoice.count({
    where: { workspaceId, status: { in: ['open', 'past_due'] } },
  });

  return {
    status: sub.status,
    tier: sub.tier,
    payment_methods: methods,
    open_invoices: openInvoices,
    trial_ends_at: sub.trialEndsAt?.toISOString() ?? null,
    current_period_end: sub.currentPeriodEnd?.toISOString() ?? null,
    last_payment_failed_at: sub.lastPaymentFailedAt?.toISOString() ?? null,
    healthy:
      sub.status === 'active' ||
      (sub.status === 'trial' && sub.trialEndsAt != null && sub.trialEndsAt > new Date()),
  };
}

export async function sendDunningLetter(workspaceId: string, invoiceId?: string) {
  const sub = await ensureSubscription(workspaceId);
  if (sub.status !== 'past_due' && sub.status !== 'active') {
    return { sent: false, reason: 'Subscription is not in a dunning-eligible state' };
  }

  const invoice = invoiceId
    ? await prisma.workspaceBillingInvoice.findFirst({ where: { id: invoiceId, workspaceId } })
    : await prisma.workspaceBillingInvoice.findFirst({
        where: { workspaceId, status: { in: ['open', 'past_due'] } },
        orderBy: { createdAt: 'desc' },
      });

  if (!invoice) {
    return { sent: false, reason: 'No overdue billing invoice found' };
  }

  return {
    sent: true,
    invoice_id: invoice.id,
    message: 'Dunning notice queued (SendGrid integration when production billing is live)',
  };
}

export async function retryFailedPayment(workspaceId: string, paymentMethodId?: string) {
  const sub = await ensureSubscription(workspaceId);
  const method =
    paymentMethodId != null
      ? await prisma.workspacePaymentMethod.findFirst({
          where: { workspaceId, id: paymentMethodId },
        })
      : await prisma.workspacePaymentMethod.findFirst({
          where: { workspaceId, isDefault: true },
        });

  if (!method) {
    return { success: false, reason: 'No payment method on file' };
  }

  await prisma.workspaceSubscription.update({
    where: { workspaceId },
    data: {
      status: 'active',
      lastPaymentFailedAt: null,
      currentPeriodStart: new Date(),
      currentPeriodEnd: addMonths(new Date(), sub.billingInterval === 'annual' ? 12 : 1),
    },
  });

  return { success: true, payment_method_id: method.id };
}
