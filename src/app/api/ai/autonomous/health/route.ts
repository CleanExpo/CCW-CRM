import { NextResponse } from 'next/server';

export async function GET() {
  const key = process.env.ANTHROPIC_API_KEY?.trim();
  const live = Boolean(key);
  return NextResponse.json({
    mode: live ? 'live' : 'demo',
    status: live ? 'healthy' : 'not_configured',
  });
}
