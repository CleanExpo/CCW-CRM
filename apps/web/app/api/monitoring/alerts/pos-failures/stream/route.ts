import { NextResponse } from "next/server";

export async function GET() {
  // Return 204 to indicate no SSE stream available
  return new NextResponse(null, { status: 204 });
}
