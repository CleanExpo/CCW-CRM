import { NextResponse } from 'next/server';
import { BACKEND_URL } from '@/lib/api/backend-url';

export async function GET() {
  try {
    // Fetch patterns from learning API
    const response = await fetch(`${BACKEND_URL}/api/ai/learning/patterns`, {
      cache: 'no-store',
      headers: { 'Content-Type': 'application/json' },
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
    console.error('Error fetching patterns:', error);
    return NextResponse.json({
      patterns: [],
      total: 0,
    });
  }
}
