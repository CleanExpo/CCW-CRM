import { NextRequest, NextResponse } from 'next/server';
import { requireAuthScope } from '@/lib/auth/data-scope';
import { listChannelInfos } from '@/lib/integrations/marketplace-dev-store';

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
  if (!ch) {
    return NextResponse.json({ detail: 'Unknown channel' }, { status: 404 });
  }
  return NextResponse.json({
    channel_type: ch.channel_type,
    display_name: ch.display_name,
    fields: ch.setup_fields,
  });
}
