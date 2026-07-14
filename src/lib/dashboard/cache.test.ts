import { afterEach, describe, expect, it, vi } from 'vitest';

describe('dashboard cache timer lifecycle', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.resetModules();
  });

  it('unrefs the cleanup timer so it cannot keep a serverless runtime alive', async () => {
    const unref = vi.fn();
    const timer = { unref } as unknown as NodeJS.Timeout;
    vi.spyOn(globalThis, 'setInterval').mockReturnValue(timer);
    vi.spyOn(globalThis, 'clearInterval').mockImplementation(() => undefined);

    const { dashboardCache } = await import('@/lib/dashboard/cache');

    expect(unref).toHaveBeenCalledOnce();
    dashboardCache.destroy();
  });
});
