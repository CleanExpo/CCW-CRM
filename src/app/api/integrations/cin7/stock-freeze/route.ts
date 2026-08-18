import { requireAuthScope } from '@/lib/auth/data-scope';
import { getCin7OmniCredentials, pingCin7Omni } from '@/lib/integrations/cin7-omni';
import { captureCin7StockFreeze, loadLatestStockFreeze } from '@/lib/integrations/cin7-stock-freeze';
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
