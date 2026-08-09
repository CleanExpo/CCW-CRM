import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const REPO_ROOT = path.resolve(__dirname, '../../../..');

describe('Cin7 reconciliation read-only gate', () => {
  it('does not call field heal or stock heal from the live recon builder', async () => {
    const src = await readFile(
      path.join(REPO_ROOT, 'src/lib/integrations/cin7-reconciliation.ts'),
      'utf8'
    );
    expect(src).not.toContain('healOptixFieldMismatchesFromCatalogs');
    expect(src).not.toContain('healOptixStockFieldMismatches');
    expect(src).not.toContain('summarizeFieldHeal');
    expect(src).toContain('read-only');
  });

  it('persists immutable snapshots from the reconciliation route', async () => {
    const src = await readFile(
      path.join(REPO_ROOT, 'src/app/api/integrations/cin7/reconciliation/route.ts'),
      'utf8'
    );
    expect(src).toContain('persistImmutableReconSnapshot');
    expect(src).toContain('read_only: true');
  });

  it('field heal goes through audited explicit action', async () => {
    const src = await readFile(
      path.join(REPO_ROOT, 'src/app/api/integrations/cin7/field-heal/route.ts'),
      'utf8'
    );
    expect(src).toContain('runAuditedFieldHeal');
    expect(src).toContain('NOT part of reconciliation');
  });
});
