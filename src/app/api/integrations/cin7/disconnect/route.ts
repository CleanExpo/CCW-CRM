import { NextResponse } from 'next/server';

/**
 * Explicit disconnect: set cin7_connected=0 so status stays disconnected
 * until the user clicks Connect (even when env credentials remain present).
 */
export async function POST() {
  const response = NextResponse.json({ status: 'disconnected' });
  response.cookies.set('cin7_connected', '0', {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 24 * 30,
  });
  return response;
}
