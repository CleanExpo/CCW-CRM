import { NextRequest, NextResponse } from 'next/server';
import { buildSendGridStatusPayload } from '@/lib/integrations/sendgrid-mail';

export async function GET(request: NextRequest) {
  const payload = await buildSendGridStatusPayload(request);
  return NextResponse.json(payload);
}
