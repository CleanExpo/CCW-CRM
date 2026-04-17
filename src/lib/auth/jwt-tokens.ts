import { SignJWT, jwtVerify } from 'jose';

function getJwtSecret(): Uint8Array | null {
  const raw = process.env.JWT_SECRET ?? process.env.JWT_SECRET_KEY;
  if (!raw) return null;
  return new TextEncoder().encode(raw);
}

export async function signAccessToken(
  userId: string,
  email: string,
  isAdmin: boolean
): Promise<string> {
  const secret = getJwtSecret();
  if (!secret) throw new Error('JWT_SECRET is not configured');
  const exp = process.env.JWT_ACCESS_EXPIRES ?? '8h';
  return new SignJWT({ email, is_admin: isAdmin, typ: 'access' })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime(exp)
    .sign(secret);
}

export async function signRefreshToken(
  userId: string,
  email: string,
  isAdmin: boolean
): Promise<string> {
  const secret = getJwtSecret();
  if (!secret) throw new Error('JWT_SECRET is not configured');
  const exp = process.env.JWT_REFRESH_EXPIRES ?? '7d';
  return new SignJWT({ email, is_admin: isAdmin, typ: 'refresh' })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime(exp)
    .sign(secret);
}

export async function signTokenPair(
  userId: string,
  email: string,
  isAdmin: boolean
): Promise<{ access_token: string; refresh_token: string }> {
  const [access_token, refresh_token] = await Promise.all([
    signAccessToken(userId, email, isAdmin),
    signRefreshToken(userId, email, isAdmin),
  ]);
  return { access_token, refresh_token };
}

/** Edge middleware: verify access JWT (not refresh). */
export async function verifyAuthAccessJwt(token: string): Promise<{
  sub: string;
  email?: string;
  is_admin: boolean;
} | null> {
  const secret = getJwtSecret();
  if (!secret) return null;
  try {
    const { payload } = await jwtVerify(token, secret, { algorithms: ['HS256'] });
    if (payload.typ !== 'access') return null;
    const sub = typeof payload.sub === 'string' ? payload.sub : '';
    if (!sub) return null;
    const email = typeof payload.email === 'string' ? payload.email : undefined;
    const is_admin = payload.is_admin === true;
    return { sub, email, is_admin };
  } catch {
    return null;
  }
}

export async function verifyRefreshJwt(token: string): Promise<{
  sub: string;
  email: string;
  is_admin: boolean;
} | null> {
  const secret = getJwtSecret();
  if (!secret) return null;
  try {
    const { payload } = await jwtVerify(token, secret, { algorithms: ['HS256'] });
    if (payload.typ !== 'refresh') return null;
    const sub = typeof payload.sub === 'string' ? payload.sub : '';
    const email = typeof payload.email === 'string' ? payload.email : '';
    if (!sub || !email) return null;
    return { sub, email, is_admin: payload.is_admin === true };
  } catch {
    return null;
  }
}

/** Verify Bearer access token for `/api/auth/me` etc. */
export async function verifyAccessJwt(token: string): Promise<{
  sub: string;
  email: string;
  is_admin: boolean;
} | null> {
  const secret = getJwtSecret();
  if (!secret) return null;
  try {
    const { payload } = await jwtVerify(token, secret, { algorithms: ['HS256'] });
    if (payload.typ !== 'access') return null;
    const sub = typeof payload.sub === 'string' ? payload.sub : '';
    const email = typeof payload.email === 'string' ? payload.email : '';
    if (!sub || !email) return null;
    return { sub, email, is_admin: payload.is_admin === true };
  } catch {
    return null;
  }
}
