import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    connected: false,
    mode: "demo",
    from_email: null,
    ai_auto_response_enabled: false,
  });
}
