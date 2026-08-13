/**
 * Closed residual (B1) for Phase 1 sign-off.
 *
 * Stock is deliberately excluded — the client asked for a record-by-record list of
 * products, customers, suppliers and tax codes only, each with a reason, from the
 * last complete acceptance run. Live Cin7 is not re-walked (that path 429s).
 */

import { prisma } from '@/lib/db/prisma';

export const B1_CLOSED_RESIDUAL_ENTITIES = [
  'products',
  'customers',
  'suppliers',
  'tax-codes',
] as const;

export type Cin7B1ResidualEntity = (typeof B1_CLOSED_RESIDUAL_ENTITIES)[number];

export type Cin7B1ResidualReason = 'missing_in_optix' | 'extra_in_optix';

export type Cin7B1ResidualRecord = {
  entity_type: Cin7B1ResidualEntity;
  cin7_id: string;
  label: string;
  reason: Cin7B1ResidualReason;
  explanation: string;
};

export type Cin7B1ResidualTally = Record<Cin7B1ResidualEntity, { missing: number; extra: number }>;

export type Cin7B1ResidualList = {
  recon_run_id: string | null;
  checked_at: string | null;
  note: string;
  counts: Cin7B1ResidualTally;
  items: Cin7B1ResidualRecord[];
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
}): string {
  const entity = isB1ClosedResidualEntity(input.entityType) ? input.entityType : null;
  const noun = entity ? ENTITY_LABEL[entity] : input.entityType.replace(/-/g, ' ');
  const name = (input.label ?? '').trim() || input.cin7Id;

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
  rows: Array<{ entityType: string; reason: string; cin7Id: string; label: string | null }>
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
      explanation: explainB1Residual({
        entityType: row.entityType,
        reason: row.reason,
        cin7Id: row.cin7Id,
        label: row.label,
      }),
    });
  }
  return items;
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
  const header = 'entity_type,cin7_id,label,reason,explanation';
  const rows = items.map((row) =>
    [
      escape(row.entity_type),
      escape(row.cin7_id),
      escape(row.label),
      escape(row.reason),
      escape(row.explanation),
    ].join(',')
  );
  return [header, ...rows].join('\n');
}

const CLOSED_RESIDUAL_NOTE =
  'Closed residual (B1) from the last complete acceptance run for this account. Stock is not part of this list — the client asked not to treat the moving Cin7 stock catalog as a closed residual. These rows are stored exceptions, not a live Cin7 walk.';

/** Last complete immutable acceptance run — never the latest blocked live refresh. */
export async function listClosedB1Residuals(ownerUserId: string): Promise<Cin7B1ResidualList> {
  const run = await prisma.cin7ReconRun.findFirst({
    where: {
      ownerUserId,
      immutable: true,
      mode: 'acceptance',
      status: 'complete',
    },
    orderBy: { checkedAt: 'desc' },
    select: { id: true, checkedAt: true },
  });

  if (!run) {
    return {
      recon_run_id: null,
      checked_at: null,
      note: `${CLOSED_RESIDUAL_NOTE} No complete acceptance snapshot exists yet — run the acceptance gate first.`,
      counts: emptyB1Tally(),
      items: [],
    };
  }

  const rows = await prisma.cin7ReconException.findMany({
    where: {
      reconRunId: run.id,
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

  const items = buildB1ResidualRecords(rows);
  return {
    recon_run_id: run.id,
    checked_at: run.checkedAt.toISOString(),
    note: CLOSED_RESIDUAL_NOTE,
    counts: tallyB1Residuals(items),
    items,
  };
}
