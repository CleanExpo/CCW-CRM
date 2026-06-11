import { NextRequest, NextResponse } from 'next/server';
import { requireAuthScope } from '@/lib/auth/data-scope';
import { getPosStore } from '@/lib/pos/mock-store';

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const scope = await requireAuthScope(request);
  if (!scope) {
    return NextResponse.json({ detail: 'Not authenticated' }, { status: 401 });
  }

  const store = getPosStore(scope.userId);
  const { id } = await params;
  const body = (await request.json()) as {
    location_code?: string;
    terminal_type?: 'physical' | 'virtual' | 'counter';
    merchant_id?: string | null;
    is_active?: boolean;
  };

  const index = store.terminals.findIndex((terminal) => terminal.id === id);
  if (index < 0) {
    return NextResponse.json({ detail: 'Terminal not found' }, { status: 404 });
  }

  const current = store.terminals[index];
  store.terminals[index] = {
    ...current,
    location_code: body.location_code ? String(body.location_code).trim() : current.location_code,
    terminal_type: body.terminal_type ?? current.terminal_type,
    merchant_id: body.merchant_id ?? current.merchant_id,
    is_active: body.is_active ?? current.is_active,
  };

  return NextResponse.json(store.terminals[index]);
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const scope = await requireAuthScope(request);
  if (!scope) {
    return NextResponse.json({ detail: 'Not authenticated' }, { status: 401 });
  }

  const store = getPosStore(scope.userId);
  const { id } = await params;
  const index = store.terminals.findIndex((terminal) => terminal.id === id);
  if (index < 0) {
    return NextResponse.json({ detail: 'Terminal not found' }, { status: 404 });
  }

  store.terminals.splice(index, 1);
  return NextResponse.json({ success: true });
}
