import { jsonDetail } from '@/lib/auth/http';
import { NextRequest } from 'next/server';

export async function POST(_request: NextRequest) {
  return jsonDetail(
    'Public registration is disabled. Ask an owner or admin for an invitation.',
    403
  );
}
