import { NextRequest, NextResponse } from 'next/server';
import { requireAuthScope } from '@/lib/auth/data-scope';
import { getWorkspaceIdForUser } from '@/lib/auth/workspace-scope';
import {
  allowSendGridBrowserCookieOverrides,
  resolveSendGridCredentials,
  upsertWorkspaceSendGridConfig,
} from '@/lib/integrations/sendgrid-config';
import { buildSendGridStatusPayload, isValidEmailAddress } from '@/lib/integrations/sendgrid-mail';

export async function POST(request: NextRequest) {
  const scope = await requireAuthScope(request);
  if (!scope) {
    return NextResponse.json({ detail: 'Not authenticated' }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    api_key?: string;
    from_email?: string;
    from_name?: string;
    template_id_invoice?: string;
    template_id_general?: string;
    inbound_mailbox_email?: string;
  };

  const apiKeyFromBody = String(body.api_key ?? '').trim();
  const fromEmailBody = String(body.from_email ?? '').trim();
  const fromNameBody = String(body.from_name ?? '').trim();
  const templateInvoice = body.template_id_invoice?.trim();
  const templateGeneral = body.template_id_general?.trim();
  const inboundMailbox = body.inbound_mailbox_email?.trim();

  if (fromEmailBody && !isValidEmailAddress(fromEmailBody)) {
    return NextResponse.json({ detail: 'from_email is not a valid email address.' }, { status: 400 });
  }
  if (inboundMailbox && !isValidEmailAddress(inboundMailbox)) {
    return NextResponse.json(
      { detail: 'inbound_mailbox_email is not a valid email address.' },
      { status: 400 }
    );
  }

  const workspaceId = await getWorkspaceIdForUser(scope.userId);
  if (workspaceId && (apiKeyFromBody || fromEmailBody || fromNameBody || templateInvoice || templateGeneral || inboundMailbox)) {
    await upsertWorkspaceSendGridConfig(workspaceId, {
      ...(apiKeyFromBody ? { apiKey: apiKeyFromBody } : {}),
      ...(fromEmailBody ? { fromEmail: fromEmailBody } : {}),
      ...(fromNameBody ? { fromName: fromNameBody } : {}),
      ...(templateInvoice !== undefined ? { templateIdInvoice: templateInvoice || null } : {}),
      ...(templateGeneral !== undefined ? { templateIdGeneral: templateGeneral || null } : {}),
      ...(inboundMailbox !== undefined ? { inboundMailboxEmail: inboundMailbox || null } : {}),
    });
  }

  const creds = await resolveSendGridCredentials(request, scope.userId);
  const mergedApiKey = apiKeyFromBody || creds.apiKey;
  if (!mergedApiKey) {
    return NextResponse.json(
      {
        detail:
          'Provide a SendGrid API key, or set SENDGRID_API_KEY on the server for shared testing.',
      },
      { status: 400 }
    );
  }

  const mergedFromEmail = fromEmailBody || creds.fromEmail;
  const mergedFromName = fromNameBody || creds.fromName;

  const payload = await buildSendGridStatusPayload(
    request,
    {
      apiKey: mergedApiKey,
      fromEmail: mergedFromEmail,
      fromName: mergedFromName,
      apiKeySource: apiKeyFromBody
        ? allowSendGridBrowserCookieOverrides()
          ? 'cookie'
          : 'workspace'
        : creds.source,
      creds: {
        ...creds,
        apiKey: mergedApiKey,
        fromEmail: mergedFromEmail,
        fromName: mergedFromName,
      },
    },
    scope.userId
  );

  const res = NextResponse.json(payload);

  if (allowSendGridBrowserCookieOverrides()) {
    const secure = process.env.NODE_ENV === 'production';
    const common = {
      httpOnly: true,
      sameSite: 'lax' as const,
      secure,
      path: '/',
      maxAge: 60 * 60 * 24 * 30,
    };
    if (apiKeyFromBody) res.cookies.set('sendgrid_api_key', apiKeyFromBody, common);
    if (fromEmailBody) res.cookies.set('sendgrid_from_email', fromEmailBody, common);
    if (fromNameBody) res.cookies.set('sendgrid_from_name', fromNameBody, common);
  }

  return res;
}
