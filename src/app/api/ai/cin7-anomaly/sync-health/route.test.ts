/**
 * UNI-2668 Phase 0c — a health endpoint must be able to say "I do not know".
 *
 * This route used to return a hard-coded `score: 100, grade: 'A'` with
 * `total_syncs: 0`, and the Cin7 dashboard widget rendered that as a live
 * grade. These tests pin two things at once:
 *
 *   - it never issues a grade it did not measure, and
 *   - it stays HTTP 200, because `apiClient.get` throws on any non-2xx
 *     (src/lib/api/client.ts:259-263), so a 5xx would crash the widget
 *     instead of letting it render the honest "unknown".
 */
import { describe, it, expect } from 'vitest';
import { GET } from './route';

describe('GET /api/ai/cin7-anomaly/sync-health', () => {
  it('responds 200 so the API client does not throw', async () => {
    const res = await GET();
    expect(res.status).toBe(200);
  });

  it('issues no score and no grade', async () => {
    const body = await (await GET()).json();
    expect(body.score).toBeNull();
    expect(body.grade).toBeNull();
  });

  it('never reports the fabricated grade A', async () => {
    const body = await (await GET()).json();
    expect(body.grade).not.toBe('A');
  });

  it('never reports a perfect score', async () => {
    const body = await (await GET()).json();
    expect(body.score).not.toBe(100);
  });

  it('marks itself unknown and says why', async () => {
    const body = await (await GET()).json();
    expect(body.status).toBe('unknown');
    expect(body.reason).toMatch(/not implemented/i);
  });

  it('returns no details block rather than zero-filled metrics', async () => {
    const body = await (await GET()).json();
    expect(body.details).toBeNull();
  });
});
