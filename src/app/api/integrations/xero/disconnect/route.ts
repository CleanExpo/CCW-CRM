import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';

export async function POST() {
  try {
    const supabase = createServerClient();

    const { error } = await supabase
      .from('xero_connections')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('is_active', true);

    if (error) throw new Error(error.message);

    return NextResponse.json({ success: true, message: 'Xero disconnected.' });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ detail: message }, { status: 500 });
  }
}
