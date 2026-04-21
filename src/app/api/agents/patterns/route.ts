import { NextResponse } from "next/server";
import { requireUpstreamBase } from '@/lib/api/upstream-proxy';

export async function GET() {
  const base = requireUpstreamBase('AI learning patterns');
  if (base instanceof NextResponse) return base;

  try {
    const response = await fetch(`${base}/api/ai/learning/patterns`, {
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
  } catch (error: unknown) {
    console.error("Error fetching patterns:", error);
    return NextResponse.json({
      patterns: [],
      total: 0,
    });
  }
}
