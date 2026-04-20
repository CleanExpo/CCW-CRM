/**
 * Auth Logout Route
 *
 * Clears the auth_token cookie to end the server-side session.
 * The frontend also clears localStorage/sessionStorage separately.
 */

import { NextResponse } from 'next/server';

export async function POST() {
  const response = NextResponse.json({ message: 'Logged out' });

  response.cookies.set('auth_token', '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 0, // Expire immediately
  });

  return response;
}
