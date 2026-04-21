import { NextResponse } from "next/server";
import { requireUpstreamBase } from '@/lib/api/upstream-proxy';

export async function GET() {
  const base = requireUpstreamBase('AI learning insights');
  if (base instanceof NextResponse) return base;

  try {
    const response = await fetch(`${base}/api/ai/learning/insights`, {
      cache: "no-store",
      headers: { "Content-Type": "application/json" },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch insights: ${response.statusText}`);
    }

    const data = await response.json();
    return NextResponse.json({
      insights: data.insights || [],
      total: data.total || 0,
    });
  } catch (error: unknown) {
    console.error("Error fetching insights:", error);
    // Return empty array on error instead of hardcoded data
    return NextResponse.json({
      insights: [],
      total: 0,
      error: error instanceof Error ? error.message : "Failed to fetch insights",
    });
  }
}
