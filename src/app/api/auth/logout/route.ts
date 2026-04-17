/**
 * POST — clear httpOnly session cookies (`auth_token`, `auth_refresh`).
 */

import { clearAuthCookies } from '@/lib/auth/session-cookies';
import { jsonOk } from '@/lib/auth/http';

export async function POST() {
  const response = jsonOk({ message: 'Logged out' });
  clearAuthCookies(response);
  return response;
}
