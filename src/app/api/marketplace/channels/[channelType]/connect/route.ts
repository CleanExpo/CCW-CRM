import { NextRequest, NextResponse } from 'next/server';
import { readJsonBody } from '@/lib/auth/http';
import { requireAuthScope } from '@/lib/auth/data-scope';
import { connectChannel } from '@/lib/integrations/marketplace-dev-store';

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ channelType: string }> }
) {
  const scope = await requireAuthScope(request);
  if (!scope) {
    return NextResponse.json({ detail: 'Not authenticated' }, { status: 401 });
  }
  const { channelType } = await context.params;
  const parsed = await readJsonBody(request);
  if (!parsed.ok) return parsed.response;
  void parsed.body;
  return NextResponse.json(connectChannel(scope.userId, channelType));
}
