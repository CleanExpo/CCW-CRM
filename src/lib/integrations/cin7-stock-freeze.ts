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
    reason: `D10 freeze ${freeze.freeze_id} at ${freeze.as_of} (${freeze.cin7_keys} Cin7 keys, sha256 ${freeze.keyset_sha256.slice(0, 12)}…). Prune uses this keyset, not a live Cin7 pull.`,
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
