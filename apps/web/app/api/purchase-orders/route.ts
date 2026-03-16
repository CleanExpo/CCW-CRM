import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    items: [],
    total_pages: 0,
  });
}
