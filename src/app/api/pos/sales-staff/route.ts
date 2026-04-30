import { NextResponse } from 'next/server';
import { getPosStore } from '@/lib/pos/mock-store';

export async function GET() {
  const store = getPosStore();
  return NextResponse.json(store.staff);
}
