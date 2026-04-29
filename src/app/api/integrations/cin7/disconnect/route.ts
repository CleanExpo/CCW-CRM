import { NextResponse } from 'next/server';

export async function POST() {
  const response = NextResponse.json({ status: 'disconnected' });
  response.cookies.set('cin7_connected', '0', { path: '/', maxAge: 0 });
  return response;
}

