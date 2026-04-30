import type { NextRequest } from 'next/server';
import { getAuthClaimsFromRequest } from '@/lib/auth/request-token';

export type AuthScope = {
  userId: string;
  role: 'owner' | 'admin' | 'member' | 'billing';
  isAdmin: boolean;
};

export async function requireAuthScope(request: NextRequest): Promise<AuthScope | null> {
  const claims = await getAuthClaimsFromRequest(request);
  if (!claims) return null;
  return {
    userId: claims.sub,
    role: claims.role,
    isAdmin: claims.is_admin,
  };
}
