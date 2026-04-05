import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    items: [],
    total: 0,
    page: 1,
    page_size: 50,
    total_pages: 0,
  });
}
