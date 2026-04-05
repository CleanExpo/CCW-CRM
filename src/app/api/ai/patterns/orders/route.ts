import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    patterns: [],
    total_patterns: 0,
    analysis_period: '90d',
    generated_at: new Date().toISOString(),
  });
}

export async function POST() {
  return NextResponse.json({
    patterns: [],
    total_patterns: 0,
    analysis_period: '90d',
    generated_at: new Date().toISOString(),
  });
}
