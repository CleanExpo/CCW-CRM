import { NextResponse } from 'next/server';

/** Placeholder: persist order activity events when audit timeline is implemented. */
export async function GET(
  _request: Request,
  _context: { params: Promise<{ id: string }> }
) {
  return NextResponse.json([]);
}
