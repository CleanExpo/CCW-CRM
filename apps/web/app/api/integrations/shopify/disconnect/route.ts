import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';

/**
 * POST /api/integrations/shopify/disconnect
 * Mark Shopify connection inactive (credentials remain for reconnection).
 */
export async function POST() {
  try {
    const supabase = createServerClient();

    const { error } = await supabase
      .from('shopify_connections')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('is_active', true);

    if (error) throw error;

    return NextResponse.json({ success: true, message: 'Shopify disconnected.' });
  } catch (e) {
    return NextResponse.json({ detail: String(e) }, { status: 500 });
  }
}
