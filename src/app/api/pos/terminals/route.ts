import { randomUUID } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { requireAuthScope } from '@/lib/auth/data-scope';
import { getWorkspaceIdForUser } from '@/lib/auth/workspace-scope';
import { getPosStore } from '@/lib/pos/mock-store';

export async function GET(request: NextRequest) {
  const scope = await requireAuthScope(request);
  if (!scope) {
    return NextResponse.json({ detail: 'Not authenticated' }, { status: 401 });
  }

  const workspaceId = await getWorkspaceIdForUser(scope.userId);
  if (!workspaceId) {
    return NextResponse.json({ detail: 'No workspace found for this user' }, { status: 403 });
  }

  const store = getPosStore(workspaceId);
  return NextResponse.json({ data: store.terminals });
}

export async function POST(request: NextRequest) {
  const scope = await requireAuthScope(request);
  if (!scope) {
    return NextResponse.json({ detail: 'Not authenticated' }, { status: 401 });
  }

  const workspaceId = await getWorkspaceIdForUser(scope.userId);
  if (!workspaceId) {
    return NextResponse.json({ detail: 'No workspace found for this user' }, { status: 403 });
  }

  const store = getPosStore(workspaceId);
  const body = (await request.json()) as {
    terminal_id?: string;
    location_code?: string;
    terminal_type?: 'physical' | 'virtual' | 'counter';
    merchant_id?: string | null;
    is_active?: boolean;
  };

  const terminalId = String(body.terminal_id ?? '').trim();
  const locationCode = String(body.location_code ?? '').trim();
  if (!terminalId || !locationCode) {
    return NextResponse.json({ detail: 'terminal_id and location_code are required' }, { status: 400 });
  }

  if (store.terminals.some((terminal) => terminal.terminal_id.toLowerCase() === terminalId.toLowerCase())) {
    return NextResponse.json({ detail: 'Terminal id already exists' }, { status: 409 });
  }

  const created = {
    id: randomUUID(),
    terminal_id: terminalId,
    location_code: locationCode,
    terminal_type: body.terminal_type ?? 'counter',
    is_active: body.is_active !== false,
    merchant_id: body.merchant_id ?? null,
    last_ping_at: null,
  };

  store.terminals.unshift(created);
  return NextResponse.json(created, { status: 201 });
}
