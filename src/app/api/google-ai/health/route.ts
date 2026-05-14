import { NextResponse } from 'next/server';

export async function GET() {
  const key = process.env.GOOGLE_AI_API_KEY?.trim();
  const configured = Boolean(key);
  const default_model = process.env.GOOGLE_AI_MODEL?.trim() || 'gemini-2.0-flash';
  return NextResponse.json({
    configured,
    status: configured ? 'healthy' : 'not_configured',
    default_model,
  });
}
