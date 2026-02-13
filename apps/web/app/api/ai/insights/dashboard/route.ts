import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    insights: [],
    total: 0,
    categories: [],
  });
}
