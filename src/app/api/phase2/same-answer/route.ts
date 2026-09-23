import { requireAuthScope } from '@/lib/auth/data-scope';
import { buildSameAnswerPack } from '@/lib/phase2/run';
import { NextRequest, NextResponse } from 'next/server';

export const maxDuration = 300;

export async function GET(request: NextRequest) {
  const scope = await requireAuthScope(request);
  if (!scope) {
    return NextResponse.json({ detail: 'Not authenticated' }, { status: 401 });
  }
  if (scope.role === 'member') {
    return NextResponse.json({ detail: 'Your role does not have access to this resource' }, { status: 403 });
  }
  try {
    const pack = await buildSameAnswerPack(scope.userId);
    return NextResponse.json(pack);
  } catch {
    return NextResponse.json(
      { detail: 'Same-answer pack failed closed. Cin7 was not treated as clean.' },
      { status: 503 }
    );
  }
}
