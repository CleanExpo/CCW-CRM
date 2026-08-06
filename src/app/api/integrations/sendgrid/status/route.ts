import { requireAuthScope } from '@/lib/auth/data-scope';
import { buildSendGridStatusPayload } from '@/lib/integrations/sendgrid-mail';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const scope = await requireAuthScope(request);
  if (!scope) {
    return NextResponse.json({ detail: 'Not authenticated' }, { status: 401 });
  }
  try {
    const payload = await buildSendGridStatusPayload(request, undefined, scope.userId);
    return NextResponse.json(payload);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'SendGrid status unavailable';
    return NextResponse.json(
      {
        connected: false,
        can_send: false,
        mode: 'live',
        api_verified: false,
        message,
      },
      { status: 200 }
    );
  }
}
