import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';

/**
 * POST /api/integrations/xero/disconnect
 * Marks Xero connection inactive. Tokens remain for audit purposes.
 */
export async function POST() {
  try {
    const supabase = createServerClient();

    const { error } = await supabase
      .from('xero_connections')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('is_active', true);

    if (error) throw error;

    return NextResponse.json({ success: true, message: 'Xero disconnected.' });
  } catch (e) {
    return NextResponse.json({ detail: String(e) }, { status: 500 });
  }
}
