import { NextRequest } from 'next/server';
import { createKeepAliveSseResponse } from '@/lib/sse/create-keep-alive-sse-response';

export const runtime = 'edge';

export async function GET(request: NextRequest) {
  return createKeepAliveSseResponse(request);
}
