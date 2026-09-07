import { NextResponse } from 'next/server';

/**
 * UNI-2668: this route previously returned a hard-coded `score: 100, grade: 'A'`
 * with `total_syncs: 0`. A health endpoint that cannot report unhealthy is not a
 * health endpoint — it is a green light wired to nothing, and every dashboard
 * reading it showed a perfect Cin7 sync while no sync data existed at all.
 *
 * Until the score is computed from real sync records, this reports UNKNOWN and
 * says why. `score` and `grade` are null so no caller can render a false grade.
 */
export async function GET() {
  return NextResponse.json(
    {
      status: 'unknown',
      score: null,
      grade: null,
      reason:
        'Cin7 sync health scoring is not implemented — no sync records are read, so no grade can be issued.',
      details: null,
    },
    { status: 501 },
  );
}
