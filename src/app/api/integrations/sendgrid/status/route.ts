import { NextRequest, NextResponse } from 'next/server';
import {
  getSendGridApiKey,
  getSendGridCredentialSource,
  getSendGridFromEmail,
  getSendGridFromName,
  verifySendGridApiKey,
} from '@/lib/integrations/sendgrid-mail';

function getMode() {
  return process.env.SENDGRID_MODE === 'demo' ? 'demo' : 'live';
}

export async function GET(request: NextRequest) {
  const mode = getMode();
  const apiKey = getSendGridApiKey(request);
  const fromEmail = getSendGridFromEmail(request);
  const fromName = getSendGridFromName(request);
  const credential_source = getSendGridCredentialSource(request);

  if (!apiKey) {
    return NextResponse.json({
      connected: false,
      mode: 'not_configured' as const,
      credential_source: 'none' as const,
      from_email: fromEmail,
      from_name: fromName,
      ai_auto_response_enabled: false,
      message: 'Missing SendGrid API key. Set SENDGRID_API_KEY on the server or save a key in Settings → Integrations.',
    });
  }

  let connected = true;
  let message =
    mode === 'demo'
      ? 'Demo mode active (no real email is sent).'
      : 'SendGrid API key present. Outbound mail is enabled when from address is verified in SendGrid.';

  if (mode === 'live') {
    const ok = await verifySendGridApiKey(apiKey);
    connected = ok;
    message = ok
      ? 'Connected to SendGrid.'
      : 'SendGrid rejected this API key. Replace SENDGRID_API_KEY or update the key in Settings → Integrations.';
  }

  if (connected && !fromEmail) {
    message +=
      ' Set SENDGRID_FROM_EMAIL (or From Email in settings) to a verified sender — required for sending.';
  }

  return NextResponse.json({
    connected,
    mode,
    credential_source,
    from_email: fromEmail,
    from_name: fromName,
    ai_auto_response_enabled: process.env.AI_EMAIL_AUTO_RESPONSE === 'true',
    ai_confidence_threshold: Number(process.env.AI_EMAIL_CONFIDENCE_THRESHOLD || 0.8),
    message,
  });
}
