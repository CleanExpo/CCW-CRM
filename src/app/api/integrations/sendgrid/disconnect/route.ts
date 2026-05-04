import { NextRequest, NextResponse } from 'next/server';
import { buildSendGridStatusPayload } from '@/lib/integrations/sendgrid-mail';

/** Clears SendGrid httpOnly cookies so the app falls back to server environment variables. */
export async function POST(request: NextRequest) {
  const envKey = process.env.SENDGRID_API_KEY?.trim() || null;
  const fromEmail = process.env.SENDGRID_FROM_EMAIL?.trim() || null;
  const fromName = process.env.SENDGRID_FROM_NAME?.trim() || null;

  const payload = await buildSendGridStatusPayload(request, {
    apiKey: envKey,
    fromEmail,
    fromName,
    apiKeySource: envKey ? 'environment' : null,
  });

  const res = NextResponse.json(payload);
  const clearOpts = {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 0,
  };
  for (const name of ['sendgrid_api_key', 'sendgrid_from_email', 'sendgrid_from_name'] as const) {
    res.cookies.set(name, '', clearOpts);
  }
  return res;
}
