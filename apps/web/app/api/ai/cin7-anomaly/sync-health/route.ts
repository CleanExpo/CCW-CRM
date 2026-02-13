import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    score: 100,
    grade: "A",
    details: {
      success_rate: 100,
      success_score: 100,
      duration_score: 100,
      volume_score: 100,
      total_syncs: 0,
      avg_duration_ms: 0,
    },
  });
}
