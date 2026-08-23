/**
 * Closed residual (B1) for Phase 1 sign-off.
 *
 * Stock is deliberately excluded — the client asked for a record-by-record list of
 * products, customers, suppliers and tax codes only, each with a reason.
 * Sign-off rows are standing extras on the latest complete acceptance, plus
 * missings that were already missing at the freeze as-of. Post-as-of Cin7
 * creates are sync lag and are excluded from the closed counts.
 * Live Cin7 is not re-walked (that path 429s).
 */

import { prisma } from '@/lib/db/prisma';
import { loadLatestStockFreeze } from '@/lib/integrations/cin7-stock-freeze';

export const B1_CLOSED_RESIDUAL_ENTITIES = [
  'products',
  'customers',
  'suppliers',
  'tax-codes',
] as const;

export type Cin7B1ResidualEntity = (typeof B1_CLOSED_RESIDUAL_ENTITIES)[number];

export type Cin7B1ResidualReason = 'missing_in_optix' | 'extra_in_optix';

export type Cin7B1ResidualBucket = 'closed' | 'sync_lag';

export type Cin7B1ResidualRecord = {
  entity_type: Cin7B1ResidualEntity;
  cin7_id: string;
  label: string;
  reason: Cin7B1ResidualReason;
  bucket: Cin7B1ResidualBucket;
  explanation: string;
};

export type Cin7B1ResidualTally = Record<Cin7B1ResidualEntity, { missing: number; extra: number }>;

export type Cin7B1ResidualList = {
  recon_run_id: string | null;
  checked_at: string | null;
  as_of_run_id: string | null;
  as_of_checked_at: string | null;
  freeze_as_of: string | null;
  note: string;
  counts: Cin7B1ResidualTally;
  items: Cin7B1ResidualRecord[];
  sync_lag_counts: Cin7B1ResidualTally;
  sync_lag_items: Cin7B1ResidualRecord[];
};

type B1ExceptionRow = {
  entityType: string;
  reason: string;
  cin7Id: string;
  label: string | null;
};

/** Standing extras Toby listed for Phase 1 master-data sign-off. */
const STANDING_EXTRA_REASONS: Record<string, string> = {
  'customers:27148':
    'The oriental rug cleaning company (27148) is a legacy Optix customer. Cin7 no longer returns this contact. Customers are add-only, so the row stays.',
  'customers:27664':
    'Shine Carpet and Pest Services (27664) is a legacy Optix customer. Cin7 no longer returns this contact. Customers are add-only, so the row stays.',
  'suppliers:27472':
    'Nutrien Water (Total Eden) (27472) is a duplicate Optix supplier for the same Cin7 trading name. This id is not in the current Cin7 supplier walk.',
  'suppliers:27457':
    'Nutrien Water (Total Eden) (27457) is the other duplicate Optix supplier for the same Cin7 trading name. This id is not in the current Cin7 supplier walk.',
  'products:MPPHaPd':
    'Actichem System 7 Hand Pad 115 x 250mm (EACH Alt None PTO) is an Optix product-option SKU (MPPHaPd). The label is an option row (EACH / Alt / PTO), not the primary style. The Cin7 product walk did not return this option. Products are add-only, so a SKU Cin7 has stopped returning stays in Optix until it is removed explicitly. It has not been deleted.',
};

const ENTITY_LABEL: Record<Cin7B1ResidualEntity, string> = {
  products: 'product SKU',
  customers: 'customer',
  suppliers: 'supplier',
  'tax-codes': 'tax code',
};

export function isB1ClosedResidualEntity(value: string): value is Cin7B1ResidualEntity {
  return (B1_CLOSED_RESIDUAL_ENTITIES as readonly string[]).includes(value);
}

export function emptyB1Tally(): Cin7B1ResidualTally {
  return {
    products: { missing: 0, extra: 0 },
    customers: { missing: 0, extra: 0 },
    suppliers: { missing: 0, extra: 0 },
    'tax-codes': { missing: 0, extra: 0 },
  };
}

export function explainB1Residual(input: {
  entityType: string;
  reason: string;
  cin7Id: string;
  label?: string | null;
  bucket?: Cin7B1ResidualBucket;
}): string {
  const entity = isB1ClosedResidualEntity(input.entityType) ? input.entityType : null;
  const noun = entity ? ENTITY_LABEL[entity] : input.entityType.replace(/-/g, ' ');
  const name = (input.label ?? '').trim() || input.cin7Id;

  if (input.bucket === 'sync_lag' && input.reason === 'missing_in_optix') {
    return `${name} was created in Cin7 after the freeze as-of and is not yet in Optix. This is sync lag, not a closed residual.`;
  }

  if (input.reason === 'extra_in_optix') {
    const standing = STANDING_EXTRA_REASONS[`${input.entityType}:${input.cin7Id}`];
    if (standing) return standing;
  }

  if (input.reason === 'missing_in_optix') {
    if (entity === 'tax-codes') {
      return `${name} is present on the Cin7 durable acceptance snapshot and has no matching Optix tax-code row (keyed by code ${input.cin7Id}).`;
    }
    if (entity === 'products') {
      return `${name} is in the Cin7 durable acceptance snapshot (SKU ${input.cin7Id}) and has no matching Optix product keyed by that SKU.`;
    }
    if (entity === 'customers' || entity === 'suppliers') {
      return `${name} is in the Cin7 durable acceptance snapshot (Cin7 id ${input.cin7Id}) and has no matching Optix ${noun} keyed by that id.`;
    }
    return `${name} is in the Cin7 durable acceptance snapshot and is missing from Optix.`;
  }

  if (input.reason === 'extra_in_optix') {
    if (entity === 'customers') {
      return `${name} is in Optix (key ${input.cin7Id}) but was not in this acceptance snapshot. This may be an unlinked legacy CRM row or a contact Cin7 no longer returns.`;
    }
    if (entity === 'suppliers') {
      return `${name} is in Optix (key ${input.cin7Id}) but was not in this acceptance snapshot. Cin7 is source of truth for this compare — Optix holds a row Cin7 did not return.`;
    }
    if (entity === 'products') {
      return `${name} is in Optix (SKU ${input.cin7Id}) but was not in this acceptance snapshot.`;
    }
    if (entity === 'tax-codes') {
      return `${name} is stored on Optix and was not derived from this acceptance snapshot (code ${input.cin7Id}).`;
    }
    return `${name} is in Optix and was not in this acceptance snapshot.`;
  }

  return `${name}: ${input.reason.replace(/_/g, ' ')}.`;
}

export function buildB1ResidualRecords(
  rows: Array<{ entityType: string; reason: string; cin7Id: string; label: string | null }>,
  bucket: Cin7B1ResidualBucket = 'closed'
): Cin7B1ResidualRecord[] {
  const items: Cin7B1ResidualRecord[] = [];
  for (const row of rows) {
    if (!isB1ClosedResidualEntity(row.entityType)) continue;
    if (row.reason !== 'missing_in_optix' && row.reason !== 'extra_in_optix') continue;
    items.push({
      entity_type: row.entityType,
      cin7_id: row.cin7Id,
      label: (row.label ?? '').trim() || row.cin7Id,
      reason: row.reason,
      bucket,
      explanation: explainB1Residual({
        entityType: row.entityType,
        reason: row.reason,
        cin7Id: row.cin7Id,
        label: row.label,
        bucket,
      }),
    });
  }
  return items;
}

export function classifyB1AgainstAsOf(input: {
  latestRows: B1ExceptionRow[];
  asOfRows: B1ExceptionRow[] | null;
  latestIsAsOf: boolean;
}): { closed: Cin7B1ResidualRecord[]; sync_lag: Cin7B1ResidualRecord[] } {
  if (input.latestIsAsOf) {
    return { closed: buildB1ResidualRecords(input.latestRows, 'closed'), sync_lag: [] };
  }

  const asOfMissing = new Set(
    (input.asOfRows ?? [])
      .filter((row) => row.reason === 'missing_in_optix')
      .map((row) => `${row.entityType}:${row.cin7Id}`)
  );

  const closedRows: B1ExceptionRow[] = [];
  const lagRows: B1ExceptionRow[] = [];
  for (const row of input.latestRows) {
    if (row.reason === 'extra_in_optix') {
      closedRows.push(row);
      continue;
    }
    if (row.reason === 'missing_in_optix') {
      if (input.asOfRows && asOfMissing.has(`${row.entityType}:${row.cin7Id}`)) {
        closedRows.push(row);
      } else {
        lagRows.push(row);
      }
    }
  }

  return {
    closed: buildB1ResidualRecords(closedRows, 'closed'),
    sync_lag: buildB1ResidualRecords(lagRows, 'sync_lag'),
  };
}

export function tallyB1Residuals(records: Cin7B1ResidualRecord[]): Cin7B1ResidualTally {
  const counts = emptyB1Tally();
  for (const record of records) {
    if (record.reason === 'missing_in_optix') counts[record.entity_type].missing += 1;
    else counts[record.entity_type].extra += 1;
  }
  return counts;
}

export function b1ResidualsToCsv(items: Cin7B1ResidualRecord[]): string {
  const escape = (value: string) => `"${value.replace(/"/g, '""')}"`;
  const header = 'entity_type,cin7_id,label,reason,bucket,explanation';
  const rows = items.map((row) =>
    [
      escape(row.entity_type),
      escape(row.cin7_id),
      escape(row.label),
      escape(row.reason),
      escape(row.bucket),
      escape(row.explanation),
    ].join(',')
  );
  return [header, ...rows].join('\n');
}

const CLOSED_RESIDUAL_NOTE =
  'Closed residual (B1) is the standing extra/missing set at the freeze as-of. Records Cin7 created after that as-of are sync lag — listed separately and excluded from sign-off. Stock is not part of this list. These rows are stored exceptions, not a live Cin7 walk.';

function emptyB1List(note: string): Cin7B1ResidualList {
  return {
    recon_run_id: null,
    checked_at: null,
    as_of_run_id: null,
    as_of_checked_at: null,
    freeze_as_of: null,
    note,
    counts: emptyB1Tally(),
    items: [],
    sync_lag_counts: emptyB1Tally(),
    sync_lag_items: [],
  };
}

async function loadB1ExceptionRows(reconRunId: string): Promise<B1ExceptionRow[]> {
  return prisma.cin7ReconException.findMany({
    where: {
      reconRunId,
      entityType: { in: [...B1_CLOSED_RESIDUAL_ENTITIES] },
      reason: { in: ['missing_in_optix', 'extra_in_optix'] },
    },
    orderBy: [{ entityType: 'asc' }, { createdAt: 'asc' }],
    select: {
      entityType: true,
      reason: true,
      cin7Id: true,
      label: true,
    },
  });
}

/** Latest complete acceptance, classified against the freeze as-of (or the previous complete run). */
export async function listClosedB1Residuals(ownerUserId: string): Promise<Cin7B1ResidualList> {
  const latest = await prisma.cin7ReconRun.findFirst({
    where: {
      ownerUserId,
      immutable: true,
      mode: 'acceptance',
      status: 'complete',
    },
    orderBy: { checkedAt: 'desc' },
    select: { id: true, checkedAt: true },
  });

  if (!latest) {
    return emptyB1List(
      `${CLOSED_RESIDUAL_NOTE} No complete acceptance snapshot exists yet — run the acceptance gate first.`
    );
  }

  const freeze = await loadLatestStockFreeze(ownerUserId);
  const freezeAsOf = freeze?.as_of ? new Date(freeze.as_of) : null;
  const freezeAsOfValid = freezeAsOf != null && !Number.isNaN(freezeAsOf.getTime());

  let asOfRun: { id: string; checkedAt: Date } | null = null;
  if (freezeAsOfValid && freezeAsOf) {
    asOfRun = await prisma.cin7ReconRun.findFirst({
      where: {
        ownerUserId,
        immutable: true,
        mode: 'acceptance',
        status: 'complete',
        checkedAt: { lte: freezeAsOf },
      },
      orderBy: { checkedAt: 'desc' },
      select: { id: true, checkedAt: true },
    });
  } else {
    asOfRun = await prisma.cin7ReconRun.findFirst({
      where: {
        ownerUserId,
        immutable: true,
        mode: 'acceptance',
        status: 'complete',
        id: { not: latest.id },
      },
      orderBy: { checkedAt: 'desc' },
      select: { id: true, checkedAt: true },
    });
  }

  const latestIsAsOf = asOfRun?.id === latest.id;
  const latestRows = await loadB1ExceptionRows(latest.id);
  const asOfRows =
    asOfRun && asOfRun.id !== latest.id ? await loadB1ExceptionRows(asOfRun.id) : null;
  const classified = classifyB1AgainstAsOf({
    latestRows,
    asOfRows,
    latestIsAsOf,
  });

  return {
    recon_run_id: latest.id,
    checked_at: latest.checkedAt.toISOString(),
    as_of_run_id: asOfRun?.id ?? (latestIsAsOf ? latest.id : null),
    as_of_checked_at: (asOfRun ?? (latestIsAsOf ? latest : null))?.checkedAt.toISOString() ?? null,
    freeze_as_of: freezeAsOfValid && freezeAsOf ? freezeAsOf.toISOString() : null,
    note: CLOSED_RESIDUAL_NOTE,
    counts: tallyB1Residuals(classified.closed),
    items: classified.closed,
    sync_lag_counts: tallyB1Residuals(classified.sync_lag),
    sync_lag_items: classified.sync_lag,
  };
}
