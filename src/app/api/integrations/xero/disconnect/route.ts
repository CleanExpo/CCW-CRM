import { NextResponse } from 'next/server';

export async function POST() {
  const response = NextResponse.json({
    success: true,
    message: 'Xero disconnected successfully.',
  });
  response.cookies.set('xero_access_token', '', { path: '/', maxAge: 0 });
  response.cookies.set('xero_refresh_token', '', { path: '/', maxAge: 0 });
  response.cookies.set('xero_tenant_id', '', { path: '/', maxAge: 0 });
  return response;
}

