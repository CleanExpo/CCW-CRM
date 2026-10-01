import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptsDir = dirname(fileURLToPath(import.meta.url));

/** Anne Part 1.3 export — Tue 30 Sep 2026 ~11:10 AEST (Stock On Hand column). CSV avoids xlsx on prod. */
export const PHASE2_ANNE_FIXTURE_2026_09_30 = join(
  scriptsDir,
  '../fixtures/StockOnHandandAvailability-AllProducts_2026-09-30_11-10-AM.csv'
);

export function resolveAnneExportPath(anneArg) {
  const trimmed = String(anneArg ?? '').trim();
  if (!trimmed) return '';
  if (trimmed === 'fixture' || trimmed === 'fixture-2026-09-30') {
    return PHASE2_ANNE_FIXTURE_2026_09_30;
  }
  return trimmed;
}
