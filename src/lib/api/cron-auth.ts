import { timingSafeEqual } from 'crypto';
import { NextResponse } from 'next/server';

/**
 * Authorisation for scheduled endpoints.
 *
 * Every cron handler previously inlined this comparison:
 *
 *   if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) return 401;
 *
 * When CRON_SECRET is unset that template produces the literal string
 * "Bearer undefined", so a request sending exactly that header is authorised.
 * An independent reviewer demonstrated it. Twelve handlers carried the pattern,
 * which is why this lives in one place now: the dangerous state had twelve
 * writers and fixing eleven of them would have left the hole open.
 *
 * Fails closed. A missing secret means no request can be authorised, and the
 * response says so distinctly (503) rather than implying a bad credential (401),
 * so a misconfigured deployment is not mistaken for an attacker.
 */

/** Constant-time compare that tolerates differing lengths without leaking them. */
function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a, 'utf8');
  const bufB = Buffer.from(b, 'utf8');
  if (bufA.length !== bufB.length) {
    // Still burn a comparison so the early return is not a timing oracle.
    timingSafeEqual(bufA, bufA);
    return false;
  }
  return timingSafeEqual(bufA, bufB);
}

/**
 * @returns a NextResponse to return immediately, or null when authorised.
 */
export function cronAuthFailure(request: Request): NextResponse | null {
  const secret = process.env.CRON_SECRET?.trim();

  if (!secret) {
    return NextResponse.json(
      {
        success: false,
        error:
          'CRON_SECRET is not configured. Scheduled endpoints are disabled until it is set — ' +
          'they are never left open.',
      },
      { status: 503 }
    );
  }

  const header = request.headers.get('authorization');
  if (!header || !safeEqual(header, `Bearer ${secret}`)) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  return null;
}
