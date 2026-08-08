import { NextResponse } from 'next/server';
import { describe, expect, it } from 'vitest';
import {
  AUTH_ACCESS_COOKIE,
  AUTH_REFRESH_COOKIE,
  clearAuthCookies,
  setAuthSessionCookies,
} from '../session-cookies';

const SEVEN_DAYS_SEC = 60 * 60 * 24 * 7;

/** Build a JWT-shaped token whose payload carries the given exp (epoch seconds). */
function tokenWithExp(expSeconds: number): string {
  const payload = Buffer.from(JSON.stringify({ exp: expSeconds })).toString('base64url');
  return `header.${payload}.signature`;
}

function setCookieHeaders(response: NextResponse): string[] {
  const getAll = (response.headers as unknown as { getSetCookie?: () => string[] }).getSetCookie;
  if (typeof getAll === 'function') return getAll.call(response.headers);
  const single = response.headers.get('set-cookie');
  return single ? [single] : [];
}

function headerFor(response: NextResponse, cookieName: string): string {
  const match = setCookieHeaders(response).find((h) => h.startsWith(`${cookieName}=`));
  expect(match, `expected a Set-Cookie header for ${cookieName}`).toBeDefined();
  return match as string;
}

function maxAgeOf(header: string): number {
  const match = header.match(/Max-Age=(-?\d+)/i);
  expect(match, `expected Max-Age in: ${header}`).not.toBeNull();
  return Number((match as RegExpMatchArray)[1]);
}

describe('setAuthSessionCookies', () => {
  it('marks both cookies HttpOnly, SameSite=Lax and path-wide', () => {
    const response = NextResponse.json({ ok: true });
    setAuthSessionCookies(response, {
      access_token: tokenWithExp(Math.floor(Date.now() / 1000) + 3600),
      refresh_token: 'refresh-value',
    });

    for (const name of [AUTH_ACCESS_COOKIE, AUTH_REFRESH_COOKIE]) {
      const header = headerFor(response, name);
      expect(header).toMatch(/HttpOnly/i);
      expect(header).toMatch(/SameSite=lax/i);
      expect(header).toMatch(/Path=\//i);
    }
  });

  it('derives the access cookie lifetime from the token exp', () => {
    const response = NextResponse.json({ ok: true });
    setAuthSessionCookies(response, {
      access_token: tokenWithExp(Math.floor(Date.now() / 1000) + 3600),
      refresh_token: 'refresh-value',
    });

    const maxAge = maxAgeOf(headerFor(response, AUTH_ACCESS_COOKIE));
    expect(maxAge).toBeGreaterThan(3500);
    expect(maxAge).toBeLessThanOrEqual(3600);
  });

  it('caps the access cookie at seven days for a far-future exp', () => {
    const response = NextResponse.json({ ok: true });
    setAuthSessionCookies(response, {
      access_token: tokenWithExp(Math.floor(Date.now() / 1000) + SEVEN_DAYS_SEC * 4),
      refresh_token: 'refresh-value',
    });

    expect(maxAgeOf(headerFor(response, AUTH_ACCESS_COOKIE))).toBe(SEVEN_DAYS_SEC);
  });

  it('floors the access cookie at 60s for an already-expired token', () => {
    const response = NextResponse.json({ ok: true });
    setAuthSessionCookies(response, {
      access_token: tokenWithExp(Math.floor(Date.now() / 1000) - 10_000),
      refresh_token: 'refresh-value',
    });

    expect(maxAgeOf(headerFor(response, AUTH_ACCESS_COOKIE))).toBe(60);
  });

  it.each([
    ['a token with no payload segment', 'not-a-jwt'],
    ['a token whose payload is not valid base64 JSON', 'header.@@@@.signature'],
    ['a token whose payload carries no exp', `header.${Buffer.from('{}').toString('base64url')}.sig`],
  ])('falls back to one hour for %s', (_label, token) => {
    const response = NextResponse.json({ ok: true });
    setAuthSessionCookies(response, { access_token: token, refresh_token: 'refresh-value' });
    expect(maxAgeOf(headerFor(response, AUTH_ACCESS_COOKIE))).toBe(3600);
  });

  it('always gives the refresh cookie a seven-day lifetime', () => {
    const response = NextResponse.json({ ok: true });
    setAuthSessionCookies(response, {
      access_token: tokenWithExp(Math.floor(Date.now() / 1000) + 120),
      refresh_token: 'refresh-value',
    });

    expect(maxAgeOf(headerFor(response, AUTH_REFRESH_COOKIE))).toBe(SEVEN_DAYS_SEC);
  });
});

describe('clearAuthCookies', () => {
  it('expires both cookies immediately and blanks their values', () => {
    const response = NextResponse.json({ ok: true });
    clearAuthCookies(response);

    for (const name of [AUTH_ACCESS_COOKIE, AUTH_REFRESH_COOKIE]) {
      const header = headerFor(response, name);
      expect(maxAgeOf(header)).toBe(0);
      expect(header).toMatch(new RegExp(`^${name}=;`));
      expect(header).toMatch(/HttpOnly/i);
    }
  });
});
