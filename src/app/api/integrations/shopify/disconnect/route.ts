import { NextResponse } from 'next/server';

export async function POST() {
  const response = NextResponse.json({ success: true, message: 'Shopify disconnected.' });
  response.cookies.set('shopify_connected', '0', { path: '/', maxAge: 0 });
  return response;
}

