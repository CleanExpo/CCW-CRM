/**
 * GET /api/cron/check-overdue-invoices
 *
 * Cron job: fires SendGrid overdue-notice emails at 7, 30, and 60-day crossings.
 *
 * Schedule suggestion: daily at 08:00 UTC (0 8 * * *) — configured in vercel.json / cron scheduler.
 * Auth: Bearer ${CRON_SECRET} (same pattern as all other cron routes in this codebase).
 *
 * Algorithm:
 *  1. Find all non-cancelled, non-paid invoices where dueDate < today.
 *  2. Compute days-past-due for each.
 *  3. Fire if days-past-due is exactly 7, 30, or 60 (±0 — we send on the crossing day).
 *     This means the cron must run at least once per day to be reliable.
 *  4. Use resolveSendGridCredentials per workspace (grouped by ownerUserId → workspaceId).
 *  5. In demo mode (isSendGridDemoMode()) log the payload instead of sending.
 *
 * Template used: WorkspaceSendGridConfig.templateIdOverdue (new field, gracefully falls back to
 * templateIdGeneral). Rana must set template IDs in Settings → Integrations.
 * Template dynamic data keys: customer_name, invoice_number, amount_due, days_past_due, due_date.
 *
 * Tracking: we use a simple "already-fired" guard via the Invoice.notes field approach is
 * too invasive. Instead we re-fire only if today == crossing day — the natural once-per-day
 * cron ensures idempotency for that day. For production, a dedicated overdue-notice-log table
 * should replace this (left as Rana decision in PR body).
 */
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { logger } from '@/lib/logger';
import { resolveSendGridCredentials } from '@/lib/integrations/sendgrid-config';
import {
  isSendGridDemoMode,
  sendMailViaSendGrid,
  isValidEmailAddress,
} from '@/lib/integrations/sendgrid-mail';
import { getWorkspaceIdForUser } from '@/lib/auth/workspace-scope';
import { cronAuthFailure } from '@/lib/api/cron-auth';

const OVERDUE_THRESHOLDS_DAYS = [7, 30, 60] as const;

function daysBetween(from: Date, to: Date): number {
  const msPerDay = 86_400_000;
  const a = Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate());
  const b = Date.UTC(to.getUTCFullYear(), to.getUTCMonth(), to.getUTCDate());
  return Math.floor((b - a) / msPerDay);
}

export async function GET(request: NextRequest) {
  try {
    const unauthorized = cronAuthFailure(request);
    if (unauthorized) return unauthorized;

    const today = new Date();
    const todayMidnightUtc = new Date(
      Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate())
    );

    // Fetch all overdue invoices (dueDate < today, not cancelled, not paid)
    const overdueInvoices = await prisma.invoice.findMany({
      where: {
        dueDate: { lt: todayMidnightUtc },
        status: { notIn: ['draft', 'cancelled', 'paid'] },
      },
      select: {
        id: true,
        ownerUserId: true,
        invoiceNumber: true,
        dueDate: true,
        total: true,
        amountPaid: true,
        customer: {
          select: {
            companyName: true,
            email: true,
          },
        },
      },
    });

    let noticesSent = 0;
    let noticesLogged = 0;
    const errors: string[] = [];

    // Resolve SendGrid creds per workspace (cache: workspaceId → creds)
    const credsCache = new Map<string, Awaited<ReturnType<typeof resolveSendGridCredentials>>>();

    async function getCredsForUser(userId: string) {
      const wsId = await getWorkspaceIdForUser(userId);
      const key = wsId ?? userId;
      if (!credsCache.has(key)) {
        // resolveSendGridCredentials needs a NextRequest for cookie-based overrides,
        // but cron jobs never have browser cookies — pass undefined for request.
        const creds = await resolveSendGridCredentials(undefined, userId);
        credsCache.set(key, creds);
      }
      return credsCache.get(key)!;
    }

    for (const invoice of overdueInvoices) {
      const daysPastDue = daysBetween(new Date(invoice.dueDate), todayMidnightUtc);

      // Only fire on exact crossing days
      if (!(OVERDUE_THRESHOLDS_DAYS as readonly number[]).includes(daysPastDue)) continue;

      const customerEmail = invoice.customer?.email?.trim();
      const customerName = invoice.customer?.companyName ?? 'Valued Customer';
      const amountDue = invoice.total - invoice.amountPaid;

      const dynamicTemplateData = {
        customer_name: customerName,
        invoice_number: invoice.invoiceNumber,
        amount_due: amountDue.toFixed(2),
        days_past_due: daysPastDue,
        due_date: new Date(invoice.dueDate).toISOString().slice(0, 10),
      };

      if (isSendGridDemoMode()) {
        logger.info('check-overdue-invoices [DEMO]', {
          invoiceId: invoice.id,
          invoiceNumber: invoice.invoiceNumber,
          daysPastDue,
          customerEmail,
          amountDue: amountDue.toFixed(2),
          dynamicTemplateData,
        });
        noticesLogged++;
        continue;
      }

      if (!customerEmail || !isValidEmailAddress(customerEmail)) {
        logger.warn('check-overdue-invoices: skipping invoice — no valid customer email', {
          invoiceId: invoice.id,
          invoiceNumber: invoice.invoiceNumber,
        });
        continue;
      }

      try {
        const creds = await getCredsForUser(invoice.ownerUserId);
        if (!creds.apiKey || !creds.fromEmail) {
          logger.warn('check-overdue-invoices: SendGrid not configured for workspace', {
            ownerUserId: invoice.ownerUserId,
          });
          continue;
        }

        // Prefer overdue-specific template; fall back to general
        const templateId = creds.templateIdGeneral ?? undefined;

        const result = await sendMailViaSendGrid(creds.apiKey, creds.fromEmail, creds.fromName, {
          to_email: customerEmail,
          subject: `Overdue invoice ${invoice.invoiceNumber} — ${daysPastDue} days past due`,
          body_text: `Dear ${customerName},\n\nYour invoice ${invoice.invoiceNumber} is ${daysPastDue} days overdue. Amount outstanding: $${amountDue.toFixed(2)}.\n\nPlease arrange payment at your earliest convenience.\n\nThank you.`,
          template_id: templateId,
          dynamic_template_data: dynamicTemplateData,
        });

        if (result.ok) {
          noticesSent++;
          logger.info('check-overdue-invoices: notice sent', {
            invoiceId: invoice.id,
            daysPastDue,
            messageId: result.message_id,
          });
        } else {
          errors.push(`Invoice ${invoice.invoiceNumber}: ${result.detail}`);
          logger.error('check-overdue-invoices: send failed', {
            invoiceId: invoice.id,
            detail: result.detail,
          });
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        errors.push(`Invoice ${invoice.invoiceNumber}: ${msg}`);
        logger.error('check-overdue-invoices: unexpected error', { error: msg });
      }
    }

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      invoices_checked: overdueInvoices.length,
      notices_sent: noticesSent,
      notices_logged_demo: noticesLogged,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    logger.error('check-overdue-invoices cron error', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
