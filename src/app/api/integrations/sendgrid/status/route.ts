import { NextRequest, NextResponse } from 'next/server';
import { requireAuthScope } from '@/lib/auth/data-scope';
import { buildSendGridStatusPayload } from '@/lib/integrations/sendgrid-mail';

export async function GET(request: NextRequest) {
  const scope = await requireAuthScope(request);
  if (!scope) {
    return NextResponse.json({ detail: 'Not authenticated' }, { status: 401 });
  }
  const payload = await buildSendGridStatusPayload(request, undefined, scope.userId);
  return NextResponse.json(payload);
}
