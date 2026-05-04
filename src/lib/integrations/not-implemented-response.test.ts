import { describe, expect, it } from 'vitest';
import { notImplementedResponse } from './not-implemented-response';

describe('notImplementedResponse', () => {
  it('returns 501 with code', async () => {
    const res = notImplementedResponse('TestIntegration', 'Feature X');
    expect(res.status).toBe(501);
    const body = (await res.json()) as { code?: string };
    expect(body.code).toBe('not_implemented');
  });
});
