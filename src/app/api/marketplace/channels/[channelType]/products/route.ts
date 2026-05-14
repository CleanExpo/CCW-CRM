import { NextRequest, NextResponse } from 'next/server';
import { requireAuthScope } from '@/lib/auth/data-scope';
import { channelProducts, listChannelInfos } from '@/lib/integrations/marketplace-dev-store';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ channelType: string }> }
) {
  const scope = await requireAuthScope(request);
  if (!scope) {
    return NextResponse.json({ detail: 'Not authenticated' }, { status: 401 });
  }
  const { channelType } = await context.params;
  const channels = listChannelInfos(scope.userId);
  const ch = channels.find((c) => c.channel_type === channelType);
  if (!ch?.connected) {
    return NextResponse.json({ detail: 'Channel is not connected' }, { status: 400 });
  }
  return NextResponse.json(channelProducts(scope.userId, channelType));
}
