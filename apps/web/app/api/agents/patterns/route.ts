import { NextResponse } from "next/server";

export async function GET() {
  try {
    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";

    // Fetch patterns from learning API
    const response = await fetch(`${backendUrl}/api/ai/learning/patterns`, {
      cache: "no-store",
      headers: { "Content-Type": "application/json" },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch patterns: ${response.statusText}`);
    }

    const data = await response.json();

    return NextResponse.json({
      patterns: data.patterns || [],
      total: data.total || 0,
    });
  } catch (error: any) {
    console.error("Error fetching patterns:", error);
    return NextResponse.json({
      patterns: [],
      total: 0,
    });
  }
}
