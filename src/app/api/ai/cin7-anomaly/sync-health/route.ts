import { NextResponse } from 'next/server';

/**
 * UNI-2668: this route previously returned a hard-coded `score: 100, grade: 'A'`
 * alongside `total_syncs: 0`. A health endpoint that cannot report unhealthy is
 * not a health endpoint — it is a green light wired to nothing, and the Cin7
 * dashboard widget rendered that fabricated "A (100)" as a live grade.
 *
 * Until the score is computed from real sync records this reports UNKNOWN and
 * says why. `score`, `grade` and `details` are null so no caller can render a
 * grade that was never measured.
 *
 * Deliberately HTTP 200, not 501: `apiClient.get` throws `ApiClientError` on any
 * non-2xx (src/lib/api/client.ts:259-263), so a 5xx here would surface as a
 * crashed widget rather than an honest "unknown". The request succeeded; the
 * answer is that the grade is unknown. That distinction is the whole point.
 */
export async function GET() {
  return NextResponse.json({
    status: 'unknown',
    score: null,
    grade: null,
    reason:
      'Cin7 sync health scoring is not implemented — no sync records are read, so no grade can be issued.',
    details: null,
  });
}
