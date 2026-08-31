import { describe, expect, it, vi } from 'vitest';

import {
  ANNE_SOH_2026_08_31,
  parseStoreAnneCliArgs,
  storeAnneExportByEmail,
} from '../cin7-store-anne-cli';

describe('parseStoreAnneCliArgs', () => {
  it('requires --email and defaults to the 31 Aug Anne SOH capture', () => {
    expect(() => parseStoreAnneCliArgs([])).toThrow(/--email/i);
    const parsed = parseStoreAnneCliArgs(['--email', 'Toby@CcW.example']);
    expect(parsed.email).toBe('toby@ccw.example');
    expect(parsed.dryRun).toBe(false);
    expect(parsed.confirmRemote).toBe(false);
    expect(parsed.input).toEqual(ANNE_SOH_2026_08_31);
  });

  it('accepts --confirm-remote and --dry-run', () => {
    const parsed = parseStoreAnneCliArgs([
      '--email',
      'toby@ccw.example',
      '--confirm-remote',
      '--dry-run',
    ]);
    expect(parsed.confirmRemote).toBe(true);
    expect(parsed.dryRun).toBe(true);
  });
});

describe('storeAnneExportByEmail', () => {
  it('resolves the Optix user by email and persists Anne’s export on that freeze', async () => {
    const persist = vi.fn().mockResolvedValue({
      anne_export_total_quantity: ANNE_SOH_2026_08_31.total_quantity,
    });
    const result = await storeAnneExportByEmail({
      email: 'toby@ccw.example',
      input: ANNE_SOH_2026_08_31,
      findUserByEmail: async (email: string) => ({ id: 'user-toby', email }),
      persistAnne: persist,
    });
    expect(persist).toHaveBeenCalledWith('user-toby', ANNE_SOH_2026_08_31);
    expect(result.ownerUserId).toBe('user-toby');
    expect(result.email).toBe('toby@ccw.example');
  });

  it('fails when the email is not an Optix account', async () => {
    await expect(
      storeAnneExportByEmail({
        email: 'missing@ccw.example',
        input: ANNE_SOH_2026_08_31,
        findUserByEmail: async () => null,
        persistAnne: vi.fn(),
      })
    ).rejects.toThrow(/no Optix account/i);
  });
});
