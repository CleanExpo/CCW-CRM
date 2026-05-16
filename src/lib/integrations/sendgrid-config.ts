import type { NextRequest } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { getWorkspaceIdForUser } from '@/lib/auth/workspace-scope';

export type SendGridCredentialSource = 'environment' | 'workspace' | 'cookie' | null;

export type ResolvedSendGridCredentials = {
  apiKey: string | null;
  fromEmail: string | null;
  fromName: string | null;
  templateIdInvoice: string | null;
  templateIdGeneral: string | null;
  inboundMailboxEmail: string | null;
  source: SendGridCredentialSource;
  workspaceConfigured: boolean;
};

export function allowSendGridBrowserCookieOverrides(): boolean {
  if (process.env.NODE_ENV === 'production') return false;
  return process.env.ALLOW_SENDGRID_BROWSER_OVERRIDES !== 'false';
}

export async function loadWorkspaceSendGridConfig(workspaceId: string) {
  return prisma.workspaceSendGridConfig.findUnique({ where: { workspaceId } });
}

export async function resolveSendGridCredentials(
  request?: NextRequest,
  userId?: string
): Promise<ResolvedSendGridCredentials> {
  const envKey = process.env.SENDGRID_API_KEY?.trim() || null;
  const envFrom = process.env.SENDGRID_FROM_EMAIL?.trim() || null;
  const envName = process.env.SENDGRID_FROM_NAME?.trim() || null;

  let workspaceRow: Awaited<ReturnType<typeof loadWorkspaceSendGridConfig>> = null;
  if (userId) {
    const workspaceId = await getWorkspaceIdForUser(userId);
    if (workspaceId) {
      workspaceRow = await loadWorkspaceSendGridConfig(workspaceId);
    }
  }

  const cookieKey = allowSendGridBrowserCookieOverrides()
    ? request?.cookies.get('sendgrid_api_key')?.value?.trim() || null
    : null;
  const cookieFrom = allowSendGridBrowserCookieOverrides()
    ? request?.cookies.get('sendgrid_from_email')?.value?.trim() || null
    : null;
  const cookieName = allowSendGridBrowserCookieOverrides()
    ? request?.cookies.get('sendgrid_from_name')?.value?.trim() || null
    : null;

  const wsKey = workspaceRow?.apiKey?.trim() || null;
  const wsFrom = workspaceRow?.fromEmail?.trim() || null;
  const wsName = workspaceRow?.fromName?.trim() || null;

  let apiKey: string | null = null;
  let source: SendGridCredentialSource = null;

  if (process.env.NODE_ENV === 'production') {
    apiKey = envKey || wsKey;
    source = envKey ? 'environment' : wsKey ? 'workspace' : null;
  } else {
    apiKey = cookieKey || envKey || wsKey;
    source = cookieKey ? 'cookie' : envKey ? 'environment' : wsKey ? 'workspace' : null;
  }

  return {
    apiKey,
    fromEmail: cookieFrom || wsFrom || envFrom,
    fromName: cookieName || wsName || envName,
    templateIdInvoice: workspaceRow?.templateIdInvoice?.trim() || process.env.SENDGRID_TEMPLATE_ID_INVOICE?.trim() || null,
    templateIdGeneral: workspaceRow?.templateIdGeneral?.trim() || process.env.SENDGRID_TEMPLATE_ID_GENERAL?.trim() || null,
    inboundMailboxEmail:
      workspaceRow?.inboundMailboxEmail?.trim() || process.env.SENDGRID_INBOUND_MAILBOX?.trim() || envFrom,
    source,
    workspaceConfigured: Boolean(wsKey || wsFrom),
  };
}

export async function upsertWorkspaceSendGridConfig(
  workspaceId: string,
  input: {
    apiKey?: string | null;
    fromEmail?: string | null;
    fromName?: string | null;
    templateIdInvoice?: string | null;
    templateIdGeneral?: string | null;
    inboundMailboxEmail?: string | null;
  }
) {
  const existing = await loadWorkspaceSendGridConfig(workspaceId);
  const pick = (next: string | null | undefined, prev: string | null | undefined) => {
    if (next === undefined) return prev ?? null;
    const t = next?.trim();
    return t ? t : null;
  };

  return prisma.workspaceSendGridConfig.upsert({
    where: { workspaceId },
    create: {
      workspaceId,
      apiKey: pick(input.apiKey, null),
      fromEmail: pick(input.fromEmail, null),
      fromName: pick(input.fromName, null),
      templateIdInvoice: pick(input.templateIdInvoice, null),
      templateIdGeneral: pick(input.templateIdGeneral, null),
      inboundMailboxEmail: pick(input.inboundMailboxEmail, null),
    },
    update: {
      apiKey: pick(input.apiKey, existing?.apiKey),
      fromEmail: pick(input.fromEmail, existing?.fromEmail),
      fromName: pick(input.fromName, existing?.fromName),
      templateIdInvoice: pick(input.templateIdInvoice, existing?.templateIdInvoice),
      templateIdGeneral: pick(input.templateIdGeneral, existing?.templateIdGeneral),
      inboundMailboxEmail: pick(input.inboundMailboxEmail, existing?.inboundMailboxEmail),
    },
  });
}
