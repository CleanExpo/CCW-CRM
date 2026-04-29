import { NextRequest, NextResponse } from 'next/server';

function getMode() {
  return process.env.SENDGRID_MODE === 'demo' ? 'demo' : 'live';
}

export async function GET(request: NextRequest) {
  const mode = getMode();
  const apiKey =
    request.cookies.get('sendgrid_api_key')?.value?.trim() || process.env.SENDGRID_API_KEY?.trim();
  const fromEmail =
    request.cookies.get('sendgrid_from_email')?.value?.trim() ||
    process.env.SENDGRID_FROM_EMAIL?.trim() ||
    null;
  const fromName =
    request.cookies.get('sendgrid_from_name')?.value?.trim() ||
    process.env.SENDGRID_FROM_NAME?.trim() ||
    null;

  if (!apiKey) {
    return NextResponse.json({
      connected: false,
      mode: 'not_configured',
      from_email: fromEmail,
      from_name: fromName,
      ai_auto_response_enabled: false,
      message: 'Missing SENDGRID_API_KEY.',
    });
  }

  return NextResponse.json({
    connected: true,
    mode,
    from_email: fromEmail,
    from_name: fromName,
    ai_auto_response_enabled: process.env.AI_EMAIL_AUTO_RESPONSE === 'true',
    ai_confidence_threshold: Number(process.env.AI_EMAIL_CONFIDENCE_THRESHOLD || 0.8),
    message: mode === 'demo' ? 'Demo mode active.' : 'Connected to SendGrid.',
  });
}
