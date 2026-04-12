/**
 * Auth Login Proxy Route
 *
 * Proxies login requests to the FastAPI backend and sets the auth_token
 * cookie on the response. This solves the cross-domain cookie problem:
 * Railway backend sets cookies with Domain=localhost which browsers on
 * vercel.app ignore. By proxying through this same-origin route, the
 * cookie is set on the vercel.app domain where the middleware can read it.
 */

import { NextRequest, NextResponse } from 'next/server';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Forward login request to FastAPI backend
    const backendResponse = await fetch(`${BACKEND_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: body.email,
        password: body.password,
      }),
    });

    const data = await backendResponse.json();

    if (!backendResponse.ok) {
      return NextResponse.json(data, { status: backendResponse.status });
    }

    // Build the response with the auth data
    const response = NextResponse.json(data);

    // Set auth_token cookie on the same-origin domain (vercel.app)
    // This is what the Next.js middleware reads for route protection
    if (data.access_token) {
      response.cookies.set('auth_token', data.access_token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: 60 * 60 * 8, // 8 hours (matches backend JWT expiry)
      });
    }

    return response;
  } catch (error) {
    console.error('[auth/login proxy] Error:', error);
    return NextResponse.json({ error: 'Authentication service unavailable' }, { status: 503 });
  }
}
