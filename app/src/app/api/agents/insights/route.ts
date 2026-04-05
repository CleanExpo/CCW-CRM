import { NextResponse } from "next/server";
import { BACKEND_URL } from '@/lib/api/backend-url';

export async function GET() {
  try {
    // Fetch insights from backend API (now working after cache fix)
    const response = await fetch(`${BACKEND_URL}/api/ai/learning/insights`, {
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
