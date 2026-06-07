import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { invoiceToApi } from '@/lib/db/api-serialize';
import { deriveInvoiceStatus } from '@/lib/db/invoice-status';
import { requireAuthScope } from '@/lib/auth/data-scope';
import { getWorkspaceMemberUserIds } from '@/lib/auth/workspace-scope';
import { buildInvoiceEmailPayload } from '@/lib/integrations/invoice-email';
import {
  getSendGridSendReadiness,
  isValidEmailAddress,
  resolveSendGridFromEmail,
  sendMailViaSendGrid,
} from '@/lib/integrations/sendgrid-mail';
import { logOperationalEvent } from '@/lib/comms/operational-events';
import { dispatchWorkflowTrigger } from '@/lib/workflows/workflow-engine';

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const scope = await requireAuthScope(request);
    if (!scope) return NextResponse.json({ detail: 'Not authenticated' }, { status: 401 });

    const workspaceUserIds = await getWorkspaceMemberUserIds(scope.userId);
    const { id } = await context.params;

    const existing = await prisma.invoice.findFirst({
      where: { id, ownerUserId: { in: workspaceUserIds } },
    });
    if (!existing) {
      return NextResponse.json({ detail: 'Not found' }, { status: 404 });
    }
    if (existing.status !== 'draft') {
      return NextResponse.json({ detail: 'Only draft invoices can be marked sent' }, { status: 400 });
    }

    const updated = await prisma.invoice.update({
      where: { id },
      data: { status: 'sent' },
      include: {
        customer: { select: { companyName: true, email: true } },
        items: { include: { product: true }, orderBy: { createdAt: 'asc' } },
        payments: { orderBy: { paymentDate: 'desc' } },
      },
    });

    const status = deriveInvoiceStatus(updated);
    const apiBody = invoiceToApi(updated, { statusOverride: status });

    const customerEmail = updated.customer?.email?.trim();
    let email_delivery: { sent: boolean; detail?: string } | undefined;

    if (customerEmail && isValidEmailAddress(customerEmail)) {
      const readiness = await getSendGridSendReadiness(request, scope.userId);
      if (readiness.ok) {
        const { creds } = readiness;
        const apiKey = creds.apiKey;
        const fromEmail = resolveSendGridFromEmail(request, creds);
        if (apiKey && fromEmail) {
          const { subject, body_text, body_html, dynamic_template_data } =
            buildInvoiceEmailPayload(updated);
          const mail = await sendMailViaSendGrid(apiKey, fromEmail, creds.fromName, {
            to_email: customerEmail,
            subject,
            body_text,
            body_html,
            template_id: creds.templateIdInvoice ?? undefined,
            dynamic_template_data,
          });
          email_delivery = mail.ok
            ? { sent: true }
            : { sent: false, detail: mail.detail };
        }
      } else {
        email_delivery = { sent: false, detail: readiness.detail };
      }
    }

    await logOperationalEvent({
      ownerUserId: scope.userId,
      customerId: updated.customerId,
      eventType: 'invoice',
      source: 'system',
      title: `Invoice ${updated.invoiceNumber} sent`,
      description: customerEmail ?? null,
      entityType: 'invoice',
      entityId: updated.id,
      metadata: { status, total: updated.total, email_sent: email_delivery?.sent ?? false },
    });

    void dispatchWorkflowTrigger('invoice_sent', {
      ownerUserId: scope.userId,
      triggerEntityType: 'invoice',
      triggerEntityId: updated.id,
      customerId: updated.customerId,
      customerEmail: customerEmail ?? null,
      payload: { invoice_number: updated.invoiceNumber, total: updated.total },
    });

    return NextResponse.json({
      ...apiBody,
      ...(email_delivery ? { email_delivery } : {}),
    });
  } catch (e) {
    return NextResponse.json({ detail: String(e) }, { status: 500 });
  }
}
