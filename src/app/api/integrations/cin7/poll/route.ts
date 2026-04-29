import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  const started = Date.now();
  const source = request.nextUrl.searchParams.get('source') || 'core';
  // Placeholder poll implementation with deterministic shape for UI.
  const totalChanges = 0;
  return NextResponse.json({
    source,
    total_changes: totalChanges,
    duration_ms: Date.now() - started,
  });
}

