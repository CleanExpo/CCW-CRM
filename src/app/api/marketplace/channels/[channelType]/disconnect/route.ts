import { NextRequest, NextResponse } from 'next/server';
import { requireAuthScope } from '@/lib/auth/data-scope';
import { disconnectChannel } from '@/lib/integrations/marketplace-dev-store';

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ channelType: string }> }
) {
  const scope = await requireAuthScope(request);
  if (!scope) {
    return NextResponse.json({ detail: 'Not authenticated' }, { status: 401 });
  }
  const { channelType } = await context.params;
  return NextResponse.json(disconnectChannel(scope.userId, channelType));
}
