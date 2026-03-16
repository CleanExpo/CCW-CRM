import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    insights: [],
    generated_at: new Date().toISOString(),
    summary: 'AI insights require backend connection',
  });
}

export async function POST() {
  return NextResponse.json({
    insights: [],
    generated_at: new Date().toISOString(),
    summary: 'AI sales analysis is not available in this deployment',
  });
}
