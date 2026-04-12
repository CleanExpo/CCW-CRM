import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';

export async function POST() {
  try {
    const supabase = createServerClient();

    const { error } = await supabase
      .from('shopify_connections')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('is_active', true);

    if (error) throw new Error(error.message);

    return NextResponse.json({ success: true, message: 'Shopify disconnected.' });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ detail: message }, { status: 500 });
  }
}
