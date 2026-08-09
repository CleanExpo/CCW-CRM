/**
 * Apply a verified Stripe payment to Optix invoices (CRM or sales).
 * Only call after stripe.webhooks.constructEvent succeeds.
 */

import { prisma } from '@/lib/db/prisma';
import { logger } from '@/lib/logger';

export type StripePaymentApplyInput = {
  stripeEventId: string;
  amount: number;
  currency?: string;
  paidAt?: Date;
  paymentIntentId?: string | null;
  /** CRM Invoice.id */
  invoiceId?: string | null;
  /** SalesInvoice.id (fulfilment) */
  salesInvoiceId?: string | null;
};

export type StripePaymentApplyResult =
  | { status: 'applied'; kind: 'invoice' | 'sales_invoice'; id: string }
  | { status: 'duplicate' }
  | { status: 'ignored'; reason: string }
  | { status: 'not_found'; reason: string };

export async function applyStripeInvoicePayment(
  input: StripePaymentApplyInput
): Promise<StripePaymentApplyResult> {
  const amount = Number(input.amount);
  if (!Number.isFinite(amount) || amount <= 0) {
    return { status: 'ignored', reason: 'non_positive_amount' };
  }
  if (!input.invoiceId && !input.salesInvoiceId) {
    return {
      status: 'ignored',
      reason: 'missing_invoice_metadata',
    };
  }

  const existingCrm = await prisma.invoicePayment.findUnique({
    where: { stripeEventId: input.stripeEventId },
    select: { id: true },
  });
  if (existingCrm) return { status: 'duplicate' };

  const existingSales = await prisma.salesPayment.findUnique({
    where: { stripeEventId: input.stripeEventId },
    select: { id: true },
  });
  if (existingSales) return { status: 'duplicate' };

  const paidAt = input.paidAt ?? new Date();
  const reference = input.paymentIntentId?.trim() || `stripe_event:${input.stripeEventId}`;

  if (input.invoiceId) {
    const invoice = await prisma.invoice.findUnique({ where: { id: input.invoiceId } });
    if (!invoice) {
      return { status: 'not_found', reason: `invoice:${input.invoiceId}` };
    }
    if (invoice.status === 'cancelled') {
      return { status: 'ignored', reason: 'invoice_cancelled' };
    }

    await prisma.$transaction(async (tx) => {
      await tx.invoicePayment.create({
        data: {
          invoiceId: invoice.id,
          amount,
          paymentDate: paidAt,
          paymentMethod: 'credit_card',
          referenceNumber: reference,
          notes: 'Recorded via verified Stripe webhook',
          source: 'stripe',
          stripeEventId: input.stripeEventId,
        },
      });
      const sumPaid = await tx.invoicePayment.aggregate({
        where: { invoiceId: invoice.id },
        _sum: { amount: true },
      });
      const paid = sumPaid._sum.amount ?? 0;
      const amountDue = Math.max(0, invoice.total - paid);
      await tx.invoice.update({
        where: { id: invoice.id },
        data: {
          amountPaid: paid,
          status:
            amountDue <= 0.005 ? 'paid' : invoice.status === 'draft' ? 'sent' : invoice.status,
        },
      });
    });

    logger.info('Stripe webhook applied CRM invoice payment', {
      invoiceId: invoice.id,
      stripeEventId: input.stripeEventId,
    });
    return { status: 'applied', kind: 'invoice', id: invoice.id };
  }

  const salesId = input.salesInvoiceId!;
  const sales = await prisma.salesInvoice.findUnique({ where: { id: salesId } });
  if (!sales) {
    return { status: 'not_found', reason: `sales_invoice:${salesId}` };
  }

  await prisma.$transaction(async (tx) => {
    await tx.salesInvoice.update({
      where: { id: sales.id },
      data: { status: 'paid', paidAt },
    });
    await tx.salesPayment.create({
      data: {
        salesInvoiceId: sales.id,
        cin7InvoiceId: sales.cin7InvoiceId,
        cin7PaymentId: reference.slice(0, 64),
        paymentMethod: 'card',
        amount,
        currency: (input.currency ?? sales.currency ?? 'AUD').toUpperCase(),
        paymentDate: paidAt,
        reference,
        status: 'completed',
        source: 'stripe',
        stripeEventId: input.stripeEventId,
      },
    });
  });

  logger.info('Stripe webhook applied sales invoice payment', {
    salesInvoiceId: sales.id,
    stripeEventId: input.stripeEventId,
  });
  return { status: 'applied', kind: 'sales_invoice', id: sales.id };
}
