/**
 * D10 — named, dated Cin7 stock freeze (as-of keyset).
 *
 * Cin7 Omni /v1/Stock has no historical as-of. Freeze means we capture a
 * complete keyset once and prune/sign-off against those bytes, not a live pull.
 */

import { createHash } from 'node:crypto';

import { prisma } from '@/lib/db/prisma';
import {
  fetchFullOmniStockCatalog,
  getReconCatalogFetchOptions,
} from '@/lib/integrations/cin7-catalog-fetch';
import { dedupeOmniStockLevels, type Cin7OmniCredentials } from '@/lib/integrations/cin7-omni';
import { Prisma } from '@prisma/client';

export const CIN7_STOCK_FREEZE_PROCEDURE = 'D10';
export const CIN7_STOCK_FREEZE_TZ = 'Australia/Sydney';
export const CIN7_STOCK_FREEZE_SNAPSHOT_ENTITY = 'stock-levels-d10';

export type Cin7AnneBranchQty = {
  branch: string;
  quantity: number;
};

export type Cin7StockFreezeRecord = {
  procedure: typeof CIN7_STOCK_FREEZE_PROCEDURE;
  freeze_id: string;
  as_of: string;
  time_zone: string;
  cin7_keys: number;
  keyset_sha256: string;
  truncated: boolean;
  complete: boolean;
  cin7_reported_total: number | null;
  anne_export_row_count: number | null;
  anne_export_total_quantity: number | null;
  anne_export_value: number | null;
  anne_export_nonzero_positions: number | null;
  anne_export_per_branch: Cin7AnneBranchQty[] | null;
  anne_export_as_of: string | null;
  anne_export_captured_by: string | null;
};

export type Cin7StockFreezePayload = {
  keys: string[];
  sha256: string;
  reported_total: number | null;
};

export function normalizeStockKeyset(keys: Iterable<string>): string[] {
  return [...new Set([...keys].map((k) => k.trim()).filter(Boolean))].sort();
}

export function hashStockKeyset(keys: Iterable<string>): string {
  return createHash('sha256').update(normalizeStockKeyset(keys).join('\n')).digest('hex');
}

export function assessCin7StockFreeze(freeze: Cin7StockFreezeRecord | null): {
  prune_enabled: boolean;
  reason: string;
} {
  if (!freeze) {
    return {
      prune_enabled: false,
      reason:
        'D10 freeze has not been captured. Prune stays locked until a complete as-of Cin7 stock keyset is stored.',
    };
  }
  if (!freeze.complete || freeze.truncated || freeze.cin7_keys <= 0) {
    return {
      prune_enabled: false,
      reason: `D10 freeze ${freeze.freeze_id} is not a sign-off keyset (complete=${freeze.complete}, truncated=${freeze.truncated}, keys=${freeze.cin7_keys}).`,
    };
  }
  return {
    prune_enabled: true,
    reason: `D10 freeze ${freeze.freeze_id} at ${freeze.as_of} (${freeze.cin7_keys} Cin7 keys, sha256 ${freeze.keyset_sha256.slice(0, 12)}…). Measure Optix against this keyset; nightly stock sync is what deletes extras.`,
  };
}

export type Cin7AnneExportInput = {
  row_count: number;
  total_quantity: number;
  value: number;
  nonzero_positions: number;
  per_branch: Cin7AnneBranchQty[];
  as_of: string;
  captured_by: string;
};

export function parseAnnePerBranch(text: string): Cin7AnneBranchQty[] {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.length === 0) {
    throw new Error('Anne export per-branch breakdown is required.');
  }
  return lines.map((line) => {
    const match = line.match(/^(.+?)\s*[:=]\s*(-?\d+(?:\.\d+)?)\s*$/);
    if (!match) {
      throw new Error(`Per-branch line must be "Branch: quantity" (got ${line}).`);
    }
    const branch = match[1].trim();
    const quantity = Number(match[2]);
    if (!branch || !Number.isFinite(quantity)) {
      throw new Error(`Per-branch line must be "Branch: quantity" (got ${line}).`);
    }
    return { branch, quantity };
  });
}

function normalizeAnnePerBranch(rows: Cin7AnneBranchQty[]): Cin7AnneBranchQty[] {
  const cleaned = rows
    .map((row) => ({
      branch: row.branch.trim(),
      quantity: Number(row.quantity),
    }))
    .filter((row) => row.branch && Number.isFinite(row.quantity));
  if (cleaned.length === 0) {
    throw new Error('Anne export per-branch breakdown is required.');
  }
  return cleaned;
}

export function attachAnneExportToFreeze(
  freeze: Cin7StockFreezeRecord,
  input: Cin7AnneExportInput
): Cin7StockFreezeRecord {
  if (!Number.isFinite(input.row_count) || input.row_count <= 0) {
    throw new Error('Anne export row count must be a positive number.');
  }
  if (!Number.isFinite(input.total_quantity)) {
    throw new Error('Anne export total quantity must be a number.');
  }
  if (!Number.isFinite(input.value)) {
    throw new Error('Anne export value must be a number.');
  }
  if (!Number.isFinite(input.nonzero_positions) || input.nonzero_positions <= 0) {
    throw new Error('Anne export non-zero positions must be a positive number.');
  }
  const perBranch = normalizeAnnePerBranch(input.per_branch ?? []);
  const capturedBy = input.captured_by.trim();
  if (!capturedBy) throw new Error('Anne export captured_by is required.');
  const asOf = new Date(input.as_of);
  if (Number.isNaN(asOf.getTime())) throw new Error('Anne export as-of must be a valid timestamp.');
  return {
    ...freeze,
    anne_export_row_count: Math.floor(input.row_count),
    anne_export_total_quantity: input.total_quantity,
    anne_export_value: input.value,
    anne_export_nonzero_positions: Math.floor(input.nonzero_positions),
    anne_export_per_branch: perBranch,
    anne_export_as_of: asOf.toISOString(),
    anne_export_captured_by: capturedBy,
  };
}

function recordFromRun(input: {
  id: string;
  checkedAt: Date;
  status: string;
  summary: unknown;
}): Cin7StockFreezeRecord | null {
  const summary = (input.summary ?? {}) as {
    freeze?: Partial<Cin7StockFreezeRecord>;
    stock_evidence?: { truncated?: boolean; complete?: boolean; cin7_reported_total?: number };
  };
  const freeze = summary.freeze;
  if (!freeze?.keyset_sha256) return null;
  return {
    procedure: CIN7_STOCK_FREEZE_PROCEDURE,
    freeze_id: input.id,
    as_of: freeze.as_of ?? input.checkedAt.toISOString(),
    time_zone: freeze.time_zone ?? CIN7_STOCK_FREEZE_TZ,
    cin7_keys: freeze.cin7_keys ?? 0,
    keyset_sha256: freeze.keyset_sha256,
    truncated: Boolean(freeze.truncated ?? summary.stock_evidence?.truncated),
    complete:
      input.status === 'complete' &&
      Boolean(freeze.complete ?? summary.stock_evidence?.complete) &&
      !Boolean(freeze.truncated),
    cin7_reported_total:
      freeze.cin7_reported_total ?? summary.stock_evidence?.cin7_reported_total ?? null,
    anne_export_row_count: freeze.anne_export_row_count ?? null,
    anne_export_total_quantity: freeze.anne_export_total_quantity ?? null,
    anne_export_value: freeze.anne_export_value ?? null,
    anne_export_nonzero_positions: freeze.anne_export_nonzero_positions ?? null,
    anne_export_per_branch: Array.isArray(freeze.anne_export_per_branch)
      ? freeze.anne_export_per_branch
      : null,
    anne_export_as_of: freeze.anne_export_as_of ?? null,
    anne_export_captured_by: freeze.anne_export_captured_by ?? null,
  };
}

export async function loadLatestStockFreeze(
  ownerUserId: string
): Promise<Cin7StockFreezeRecord | null> {
  const complete = await prisma.cin7ReconRun.findFirst({
    where: { ownerUserId, mode: 'freeze', immutable: true, status: 'complete' },
    orderBy: { checkedAt: 'desc' },
    select: { id: true, checkedAt: true, status: true, summary: true },
  });
  if (complete) {
    const record = recordFromRun(complete);
    if (record && record.complete && !record.truncated && record.cin7_keys > 0) return record;
  }
  const latest = await prisma.cin7ReconRun.findFirst({
    where: { ownerUserId, mode: 'freeze', immutable: true },
    orderBy: { checkedAt: 'desc' },
    select: { id: true, checkedAt: true, status: true, summary: true },
  });
  if (!latest) return null;
  return recordFromRun(latest);
}

export async function loadStockFreezeKeyset(ownerUserId: string): Promise<{
  freeze: Cin7StockFreezeRecord;
  keys: Set<string>;
} | null> {
  const freeze = await loadLatestStockFreeze(ownerUserId);
  if (!freeze || !freeze.complete || freeze.truncated || freeze.cin7_keys <= 0) return null;
  const snap = await prisma.cin7CatalogSnapshot.findFirst({
    where: {
      ownerUserId,
      reconRunId: freeze.freeze_id,
      entityType: CIN7_STOCK_FREEZE_SNAPSHOT_ENTITY,
      complete: true,
    },
    select: { payload: true, recordCount: true },
  });
  const payload = (snap?.payload ?? {}) as Partial<Cin7StockFreezePayload>;
  const keys = normalizeStockKeyset(payload.keys ?? []);
  if (keys.length === 0) return null;
  const sha = payload.sha256 ?? hashStockKeyset(keys);
  if (sha !== freeze.keyset_sha256) return null;
  return { freeze: { ...freeze, cin7_keys: keys.length }, keys: new Set(keys) };
}

export async function captureCin7StockFreeze(input: {
  ownerUserId: string;
  omniCreds: Cin7OmniCredentials;
}): Promise<{
  freeze: Cin7StockFreezeRecord | null;
  errors: string[];
}> {
  const catalog = await fetchFullOmniStockCatalog(
    input.omniCreds,
    undefined,
    getReconCatalogFetchOptions()
  );
  const byKey = dedupeOmniStockLevels(catalog.stockLevels);
  const keys = normalizeStockKeyset(byKey.keys());
  const truncated = Boolean(catalog.truncated);
  const complete = catalog.errors.length === 0 && !truncated && keys.length > 0;
  const asOf = new Date();
  const sha = hashStockKeyset(keys);
  const status = complete ? 'complete' : 'failed';

  const freezeFields: Cin7StockFreezeRecord = {
    procedure: CIN7_STOCK_FREEZE_PROCEDURE,
    freeze_id: '',
    as_of: asOf.toISOString(),
    time_zone: CIN7_STOCK_FREEZE_TZ,
    cin7_keys: keys.length,
    keyset_sha256: sha,
    truncated,
    complete,
    cin7_reported_total: catalog.reported_total ?? null,
    anne_export_row_count: null,
    anne_export_total_quantity: null,
    anne_export_value: null,
    anne_export_nonzero_positions: null,
    anne_export_per_branch: null,
    anne_export_as_of: null,
    anne_export_captured_by: null,
  };

  const run = await prisma.cin7ReconRun.create({
    data: {
      ownerUserId: input.ownerUserId,
      mode: 'freeze',
      immutable: true,
      status,
      blockedReason: complete
        ? null
        : catalog.errors[0] ?? (truncated ? 'Cin7 stock catalog truncated' : 'Empty stock keyset'),
      optixComplete: true,
      cin7Complete: complete,
      missingCount: 0,
      extraCount: 0,
      linkedCount: keys.length,
      fieldMismatchCount: 0,
      skippedCount: 0,
      checkedAt: asOf,
      completedAt: asOf,
      summary: {
        freeze: freezeFields,
        stock_evidence: {
          cin7_rows: keys.length,
          cin7_reported_total: catalog.reported_total ?? null,
          pages_fetched: catalog.pages_fetched,
          truncated,
          complete,
        },
      } as unknown as Prisma.InputJsonValue,
    },
    select: { id: true },
  });

  freezeFields.freeze_id = run.id;
  await prisma.cin7ReconRun.update({
    where: { id: run.id },
    data: {
      summary: {
        freeze: freezeFields,
        stock_evidence: {
          cin7_rows: keys.length,
          cin7_reported_total: catalog.reported_total ?? null,
          pages_fetched: catalog.pages_fetched,
          truncated,
          complete,
        },
      } as unknown as Prisma.InputJsonValue,
    },
  });

  await prisma.cin7CatalogSnapshot.create({
    data: {
      reconRunId: run.id,
      ownerUserId: input.ownerUserId,
      entityType: CIN7_STOCK_FREEZE_SNAPSHOT_ENTITY,
      recordCount: keys.length,
      complete,
      payload: {
        keys,
        sha256: sha,
        reported_total: catalog.reported_total ?? null,
      } as Prisma.InputJsonValue,
    },
  });

  return {
    freeze: complete ? freezeFields : recordFromRun({
      id: run.id,
      checkedAt: asOf,
      status,
      summary: { freeze: freezeFields, stock_evidence: { truncated, complete } },
    }),
    errors: catalog.errors.slice(0, 20),
  };
}

export async function persistAnneExportOnLatestFreeze(
  ownerUserId: string,
  input: Cin7AnneExportInput
): Promise<Cin7StockFreezeRecord> {
  const freeze = await loadLatestStockFreeze(ownerUserId);
  if (!freeze || !freeze.complete) {
    throw new Error('Capture a complete D10 freeze before storing Anne’s export.');
  }
  const next = attachAnneExportToFreeze(freeze, input);
  const run = await prisma.cin7ReconRun.findFirst({
    where: { id: freeze.freeze_id, ownerUserId },
    select: { id: true, summary: true },
  });
  if (!run) throw new Error('D10 freeze row was not found.');
  const summary = (run.summary ?? {}) as Record<string, unknown>;
  await prisma.cin7ReconRun.update({
    where: { id: run.id },
    data: {
      summary: {
        ...summary,
        freeze: next,
      } as unknown as Prisma.InputJsonValue,
    },
  });
  return next;
}
