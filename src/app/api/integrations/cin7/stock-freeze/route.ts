import { requireAuthScope } from '@/lib/auth/data-scope';
import { getCin7OmniCredentials, pingCin7Omni } from '@/lib/integrations/cin7-omni';
import {
  captureCin7StockFreeze,
  loadLatestStockFreeze,
  parseAnnePerBranch,
  persistAnneExportOnLatestFreeze,
  type Cin7AnneBranchQty,
} from '@/lib/integrations/cin7-stock-freeze';
import { NextRequest, NextResponse } from 'next/server';

export const maxDuration = 300;

/** Latest D10 freeze metadata (count + hash). Does not return 10k keys. */
export async function GET(request: NextRequest) {
  const scope = await requireAuthScope(request);
  if (!scope) {
    return NextResponse.json({ detail: 'Not authenticated' }, { status: 401 });
  }
  const freeze = await loadLatestStockFreeze(scope.userId);
  return NextResponse.json({ freeze });
}

/**
 * Stock-only Cin7 walk that stores a named as-of keyset for D10 prune/sign-off.
 * Not a full master recon.
 */
export async function POST(request: NextRequest) {
  const scope = await requireAuthScope(request);
  if (!scope) {
    return NextResponse.json({ detail: 'Not authenticated' }, { status: 401 });
  }
  const omniCreds = getCin7OmniCredentials(request);
  if (!omniCreds || !(await pingCin7Omni(omniCreds))) {
    return NextResponse.json({ detail: 'Cin7 Omni is not reachable.' }, { status: 401 });
  }

  const result = await captureCin7StockFreeze({
    ownerUserId: scope.userId,
    omniCreds,
  });

  if (!result.freeze?.complete) {
    return NextResponse.json(
      {
        detail: 'D10 freeze capture did not produce a complete keyset.',
        ...result,
      },
      { status: 502 }
    );
  }

  return NextResponse.json({
    ...result,
    explicit_action: true,
  });
}

/** Store Anne’s Cin7 stock-on-hand export on the latest complete freeze. */
export async function PATCH(request: NextRequest) {
  const scope = await requireAuthScope(request);
  if (!scope) {
    return NextResponse.json({ detail: 'Not authenticated' }, { status: 401 });
  }
  const body = (await request.json().catch(() => ({}))) as {
    row_count?: unknown;
    total_quantity?: unknown;
    value?: unknown;
    nonzero_positions?: unknown;
    per_branch?: unknown;
    as_of?: unknown;
    captured_by?: unknown;
  };
  try {
    const freeze = await persistAnneExportOnLatestFreeze(scope.userId, {
      row_count: Number(body.row_count),
      total_quantity: Number(body.total_quantity),
      value: Number(body.value),
      nonzero_positions: Number(body.nonzero_positions),
      per_branch: parseAnnePerBranchInput(body.per_branch),
      as_of: String(body.as_of ?? ''),
      captured_by: String(body.captured_by ?? ''),
    });
    return NextResponse.json({ freeze });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not store Anne export.';
    return NextResponse.json({ detail: message }, { status: 400 });
  }
}

function parseAnnePerBranchInput(value: unknown): Cin7AnneBranchQty[] {
  if (typeof value === 'string') return parseAnnePerBranch(value);
  if (!Array.isArray(value)) return [];
  return value.flatMap((row) => {
    if (!row || typeof row !== 'object') return [];
    const rec = row as { branch?: unknown; quantity?: unknown };
    const branch = String(rec.branch ?? '').trim();
    const quantity = Number(rec.quantity);
    if (!branch || !Number.isFinite(quantity)) return [];
    return [{ branch, quantity }];
  });
}
