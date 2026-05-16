import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { invoiceToApi } from '@/lib/db/api-serialize';
import { deriveInvoiceStatus } from '@/lib/db/invoice-status';
import { requireAuthScope } from '@/lib/auth/data-scope';
import { getWorkspaceMemberUserIds } from '@/lib/auth/workspace-scope';
import { buildInvoiceEmailPayload } from '@/lib/integrations/invoice-email';
import {
  getSendGridApiKey,
  getSendGridFromName,
  getSendGridSendReadiness,
  isValidEmailAddress,
  resolveSendGridFromEmail,
  sendMailViaSendGrid,
} from '@/lib/integrations/sendgrid-mail';

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
      const readiness = await getSendGridSendReadiness(request);
      if (readiness.ok) {
        const apiKey = getSendGridApiKey(request);
        const fromEmail = resolveSendGridFromEmail(request);
        if (apiKey && fromEmail) {
          const { subject, body_text } = buildInvoiceEmailPayload(updated);
          const mail = await sendMailViaSendGrid(apiKey, fromEmail, getSendGridFromName(request), {
            to_email: customerEmail,
            subject,
            body_text,
          });
          email_delivery = mail.ok
            ? { sent: true }
            : { sent: false, detail: mail.detail };
        }
      } else {
        email_delivery = { sent: false, detail: readiness.detail };
      }
    }

    return NextResponse.json({
      ...apiBody,
      ...(email_delivery ? { email_delivery } : {}),
    });
  } catch (e) {
    return NextResponse.json({ detail: String(e) }, { status: 500 });
  }
}
