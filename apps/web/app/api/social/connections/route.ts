import { SocialCredentials, SocialPlatform, validateCredentials } from '@/src/lib/social';
import { getSupabaseClient } from '@/src/lib/supabase';
import { NextRequest, NextResponse } from 'next/server';

// GET /api/social/connections - Get all social media connections
export async function GET() {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from('social_connections')
    .select('id, platform, account_name, account_id, is_active, token_expiry, created_at')
    .order('created_at', { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Check token validity for each connection
  const connectionsWithStatus = await Promise.all(
    (data || []).map(async (conn) => {
      const isExpired = conn.token_expiry && new Date(conn.token_expiry) < new Date();
      return {
        ...conn,
        tokenExpired: isExpired,
        status: isExpired ? 'expired' : conn.is_active ? 'active' : 'inactive',
      };
    })
  );

  return NextResponse.json({
    connections: connectionsWithStatus,
    total: connectionsWithStatus.length,
    byPlatform: {
      Facebook: connectionsWithStatus.filter(c => c.platform === 'Facebook').length,
      Instagram: connectionsWithStatus.filter(c => c.platform === 'Instagram').length,
      LinkedIn: connectionsWithStatus.filter(c => c.platform === 'LinkedIn').length,
      Reddit: connectionsWithStatus.filter(c => c.platform === 'Reddit').length,
    },
  });
}

// DELETE /api/social/connections - Remove a connection
export async function DELETE(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const id = searchParams.get('id');

  if (!id) {
    return NextResponse.json({ error: 'Connection ID required' }, { status: 400 });
  }

  const supabase = getSupabaseClient();

  const { error } = await supabase
    .from('social_connections')
    .delete()
    .eq('id', id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, message: 'Connection removed' });
}

// PATCH /api/social/connections - Toggle connection active status
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, isActive } = body;

    if (!id) {
      return NextResponse.json({ error: 'Connection ID required' }, { status: 400 });
    }

    const supabase = getSupabaseClient();

    const { error } = await supabase
      .from('social_connections')
      .update({ is_active: isActive })
      .eq('id', id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });

  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// POST /api/social/connections/validate - Validate a connection's credentials
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { id } = body;

    if (!id) {
      return NextResponse.json({ error: 'Connection ID required' }, { status: 400 });
    }

    const supabase = getSupabaseClient();

    const { data: conn, error } = await supabase
      .from('social_connections')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !conn) {
      return NextResponse.json({ error: 'Connection not found' }, { status: 404 });
    }

    const credentials: SocialCredentials = {
      accessToken: conn.access_token,
      refreshToken: conn.refresh_token,
      accountId: conn.account_id,
      pageId: conn.page_id,
    };

    const isValid = await validateCredentials(conn.platform as SocialPlatform, credentials);

    return NextResponse.json({
      valid: isValid,
      platform: conn.platform,
      accountName: conn.account_name,
    });

  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
