/**
 * UNI-2111: Company settings endpoint — org-authenticated GET + PUT.
 *
 * Auth pattern mirrors POS routes merged in UNI-2107:
 *   1. requireAuthScope  → 401 if no valid JWT
 *   2. getWorkspaceIdForUser → 403 if user has no workspace row
 *   3. workspaceId from DB used as the store key (never from request)
 */
import { NextRequest, NextResponse } from 'next/server';
import { requireAuthScope } from '@/lib/auth/data-scope';
import { getWorkspaceIdForUser } from '@/lib/auth/workspace-scope';
import { getCompanySettings, saveCompanySettings } from '@/lib/settings/company-store';

export async function GET(request: NextRequest) {
  const scope = await requireAuthScope(request);
  if (!scope) {
    return NextResponse.json({ detail: 'Not authenticated' }, { status: 401 });
  }

  const workspaceId = await getWorkspaceIdForUser(scope.userId);
  if (!workspaceId) {
    return NextResponse.json({ detail: 'No workspace found for this user' }, { status: 403 });
  }

  const settings = getCompanySettings(workspaceId);
  return NextResponse.json(settings);
}

export async function PUT(request: NextRequest) {
  const scope = await requireAuthScope(request);
  if (!scope) {
    return NextResponse.json({ detail: 'Not authenticated' }, { status: 401 });
  }

  const workspaceId = await getWorkspaceIdForUser(scope.userId);
  if (!workspaceId) {
    return NextResponse.json({ detail: 'No workspace found for this user' }, { status: 403 });
  }

  const body = (await request.json()) as {
    name?: unknown;
    trading_name?: unknown;
    abn?: unknown;
    acn?: unknown;
  };

  const name = typeof body.name === 'string' ? body.name.trim() : '';
  if (!name) {
    return NextResponse.json({ detail: 'name is required' }, { status: 400 });
  }

  const updated = saveCompanySettings(workspaceId, {
    name,
    trading_name: typeof body.trading_name === 'string' ? body.trading_name.trim() || null : null,
    abn: typeof body.abn === 'string' ? body.abn.trim() || null : null,
    acn: typeof body.acn === 'string' ? body.acn.trim() || null : null,
  });

  return NextResponse.json(updated);
}
