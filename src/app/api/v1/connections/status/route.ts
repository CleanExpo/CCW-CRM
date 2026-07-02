import { NextResponse } from 'next/server';
import { buildCcwConnectionStatus } from '@/lib/connections/status';

export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json(buildCcwConnectionStatus());
}
