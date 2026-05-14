import { NextRequest, NextResponse } from 'next/server';
import { requireAuthScope } from '@/lib/auth/data-scope';
import { listChannelInfos } from '@/lib/integrations/marketplace-dev-store';

export async function GET(request: NextRequest) {
  const scope = await requireAuthScope(request);
  if (!scope) {
    return NextResponse.json({ detail: 'Not authenticated' }, { status: 401 });
  }
  const channels = listChannelInfos(scope.userId);
  return NextResponse.json({ channels, total: channels.length });
}
