import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as {
    api_key?: string;
    from_email?: string;
    from_name?: string;
  };
  const apiKey = String(body.api_key ?? '').trim();
  if (!apiKey) {
    return NextResponse.json({ detail: 'api_key is required' }, { status: 400 });
  }

  const secure = process.env.NODE_ENV === 'production';
  const common = { httpOnly: true, sameSite: 'lax' as const, secure, path: '/', maxAge: 60 * 60 * 24 * 30 };
  const response = NextResponse.json({
    connected: true,
    mode: process.env.SENDGRID_MODE === 'demo' ? 'demo' : 'live',
    from_email: body.from_email || process.env.SENDGRID_FROM_EMAIL || null,
    from_name: body.from_name || process.env.SENDGRID_FROM_NAME || null,
    ai_auto_response_enabled: process.env.AI_EMAIL_AUTO_RESPONSE === 'true',
  });
  response.cookies.set('sendgrid_api_key', apiKey, common);
  if (body.from_email) response.cookies.set('sendgrid_from_email', body.from_email, common);
  if (body.from_name) response.cookies.set('sendgrid_from_name', body.from_name, common);
  return response;
}

