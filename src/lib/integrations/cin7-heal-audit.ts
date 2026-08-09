/**
 * Explicit, logged, reversible Optix repairs — never called from reconciliation.
 */

import { prisma } from '@/lib/db/prisma';
import {
  fetchAllOmniMasterCatalogsSequential,
  getReconCatalogFetchOptions,
} from '@/lib/integrations/cin7-catalog-fetch';
import {
  healOptixFieldMismatchesFromCatalogs,
  summarizeFieldHeal,
  type Cin7FieldHealEntity,
  type Cin7FieldHealResult,
} from '@/lib/integrations/cin7-field-heal';
import type { Cin7OmniCredentials } from '@/lib/integrations/cin7-omni';
import { productFieldsMatch } from '@/lib/integrations/cin7-product-heal';
import { pruneOptixStockLevelsToCin7 } from '@/lib/integrations/cin7-stock-prune';
import {
  batchUpsertCustomers,
  batchUpsertProducts,
  batchUpsertStockLevels,
  mapOmniCustomerRows,
  mapOmniProductRows,
  mapOmniStockLevelRows,
} from '@/lib/integrations/cin7-sync-persist';
import { Prisma } from '@prisma/client';

const CIN7_PRODUCT_CATEGORY_PREFIX = 'Cin7';

type AuditRowInput = {
  entityType: string;
  recordKey: string;
  beforeJson: Prisma.InputJsonValue;
  afterJson?: Prisma.InputJsonValue;
};

async function captureFieldHealBeforeRows(
  ownerUserId: string,
  catalogs: Awaited<ReturnType<typeof fetchAllOmniMasterCatalogsSequential>>,
  entities: Set<Cin7FieldHealEntity>
): Promise<AuditRowInput[]> {
  const rows: AuditRowInput[] = [];

  if (entities.has('products') && catalogs.products.errors.length === 0) {
    const cin7BySku = new Map(
      catalogs.products.skus.map((s) => [
        s.sku,
        {
          sku: s.sku,
          name: s.name,
          price: s.price,
          stock: s.stock,
          visibility: s.visibility,
          isActive: s.isActive,
          styleCode: s.styleCode,
        },
      ])
    );
    const optix = await prisma.product.findMany({
      where: { ownerUserId, category: { startsWith: CIN7_PRODUCT_CATEGORY_PREFIX } },
      select: {
        sku: true,
        name: true,
        price: true,
        stock: true,
        isActive: true,
        cin7Visibility: true,
        cin7StyleCode: true,
        category: true,
      },
    });
    for (const o of optix) {
      const c = cin7BySku.get(o.sku);
      if (!c) continue;
      const optixRow = {
        sku: o.sku,
        name: o.name,
        price: Number(o.price),
        stock: o.stock,
        visibility: o.cin7Visibility ?? 'Unknown',
        isActive: o.isActive,
      };
      if (productFieldsMatch(optixRow, c)) continue;
      rows.push({
        entityType: 'products',
        recordKey: o.sku,
        beforeJson: {
          sku: o.sku,
          name: o.name,
          price: Number(o.price),
          stock: o.stock,
          isActive: o.isActive,
          cin7Visibility: o.cin7Visibility,
          cin7StyleCode: o.cin7StyleCode,
          category: o.category,
        },
        afterJson: c as unknown as Prisma.InputJsonValue,
      });
    }
  }

  if (entities.has('customers') && catalogs.customers.errors.length === 0) {
    const cin7ById = new Map(catalogs.customers.contacts.map((c) => [c.cin7ContactId, c]));
    const optix = await prisma.customer.findMany({
      where: {
        ownerUserId,
        cin7ContactId: { not: null },
        OR: [
          { cin7ContactType: { equals: 'Customer', mode: 'insensitive' } },
          { cin7ContactType: null },
        ],
      },
      select: {
        cin7ContactId: true,
        companyName: true,
        email: true,
        phone: true,
        city: true,
        cin7ContactType: true,
      },
    });
    for (const o of optix) {
      const id = o.cin7ContactId!;
      const c = cin7ById.get(id);
      if (!c) continue;
      const same =
        (o.companyName ?? '').trim().toLowerCase() === (c.companyName ?? '').trim().toLowerCase() &&
        (o.email ?? '').trim().toLowerCase() === (c.email ?? '').trim().toLowerCase() &&
        (o.phone ?? '').trim().toLowerCase() === (c.phone ?? '').trim().toLowerCase() &&
        (o.city ?? '').trim().toLowerCase() === (c.city ?? '').trim().toLowerCase();
      if (same) continue;
      rows.push({
        entityType: 'customers',
        recordKey: id,
        beforeJson: o as unknown as Prisma.InputJsonValue,
        afterJson: c as unknown as Prisma.InputJsonValue,
      });
    }
  }

  if (entities.has('stock') && catalogs.stockLevels.errors.length === 0) {
    const cin7ByKey = new Map(
      catalogs.stockLevels.stockLevels.map((s) => [`${s.cin7BranchId}:${s.sku}`, s])
    );
    const optix = await prisma.cin7StockLevel.findMany({
      where: { ownerUserId },
      select: {
        cin7BranchId: true,
        sku: true,
        available: true,
        stockOnHand: true,
        incoming: true,
        openSales: true,
        branchName: true,
      },
    });
    for (const o of optix) {
      const key = `${o.cin7BranchId}:${o.sku}`;
      const c = cin7ByKey.get(key);
      if (!c) continue;
      if (
        o.available === c.available &&
        o.stockOnHand === c.stockOnHand &&
        o.incoming === c.incoming
      ) {
        continue;
      }
      rows.push({
        entityType: 'stock',
        recordKey: key,
        beforeJson: o as unknown as Prisma.InputJsonValue,
        afterJson: c as unknown as Prisma.InputJsonValue,
      });
    }
  }

  return rows;
}

export async function runAuditedFieldHeal(input: {
  ownerUserId: string;
  actorUserId: string;
  omniCreds: Cin7OmniCredentials;
  entities?: Cin7FieldHealEntity[];
}): Promise<Cin7FieldHealResult & { audit_run_id: string; summary: string }> {
  const catalogs = await fetchAllOmniMasterCatalogsSequential(
    input.omniCreds,
    getReconCatalogFetchOptions()
  );
  const entities = new Set<Cin7FieldHealEntity>(
    input.entities ?? [
      'products',
      'customers',
      'suppliers',
      'branches',
      'internal-customers',
      'stock',
    ]
  );

  const beforeRows = await captureFieldHealBeforeRows(input.ownerUserId, catalogs, entities);

  const audit = await prisma.cin7HealAuditRun.create({
    data: {
      ownerUserId: input.ownerUserId,
      actionType: 'field_heal',
      status: 'applied',
      createdByUserId: input.actorUserId,
      healedTotal: 0,
      summary: { phase: 'started', entities: [...entities] } as Prisma.InputJsonValue,
      rows: {
        create: beforeRows.map((r) => ({
          ownerUserId: input.ownerUserId,
          entityType: r.entityType,
          recordKey: r.recordKey,
          beforeJson: r.beforeJson,
          afterJson: r.afterJson ?? Prisma.JsonNull,
        })),
      },
    },
    select: { id: true },
  });

  try {
    const result = await healOptixFieldMismatchesFromCatalogs(input.ownerUserId, catalogs, {
      entities: [...entities],
    });
    const summary = summarizeFieldHeal(result);
    await prisma.cin7HealAuditRun.update({
      where: { id: audit.id },
      data: {
        healedTotal: result.healed_total,
        status: result.errors.length > 0 && result.healed_total === 0 ? 'failed' : 'applied',
        summary: {
          ...result,
          summary,
          note: 'Explicit field heal — not part of reconciliation reporting.',
        } as unknown as Prisma.InputJsonValue,
      },
    });
    return { ...result, audit_run_id: audit.id, summary };
  } catch (error) {
    await prisma.cin7HealAuditRun.update({
      where: { id: audit.id },
      data: {
        status: 'failed',
        summary: {
          error: error instanceof Error ? error.message : String(error),
        } as Prisma.InputJsonValue,
      },
    });
    throw error;
  }
}

export async function runAuditedStockPrune(input: {
  ownerUserId: string;
  actorUserId: string;
  omniCreds: Cin7OmniCredentials;
  dryRun?: boolean;
}): Promise<{
  audit_run_id: string | null;
  cin7_keys: number;
  optix_before: number;
  deleted: number;
  missing_in_optix: number;
  errors: string[];
  dry_run: boolean;
}> {
  if (input.dryRun) {
    const preview = await pruneOptixStockLevelsToCin7(input.ownerUserId, input.omniCreds, {
      dryRun: true,
    });
    return { audit_run_id: null, ...preview };
  }

  // Capture surplus rows before delete for reversibility.
  const catalog = await fetchAllOmniMasterCatalogsSequential(
    input.omniCreds,
    getReconCatalogFetchOptions()
  );
  const cin7Keys = new Set(
    catalog.stockLevels.stockLevels.map((s) => `${s.cin7BranchId}:${s.sku}`)
  );
  const optixRows = await prisma.cin7StockLevel.findMany({
    where: { ownerUserId: input.ownerUserId },
  });
  const surplus = optixRows.filter((r) => !cin7Keys.has(`${r.cin7BranchId}:${r.sku}`));

  const audit = await prisma.cin7HealAuditRun.create({
    data: {
      ownerUserId: input.ownerUserId,
      actionType: 'stock_prune',
      status: 'applied',
      createdByUserId: input.actorUserId,
      deletedTotal: 0,
      summary: { phase: 'started' } as Prisma.InputJsonValue,
      rows: {
        create: surplus.map((r) => ({
          ownerUserId: input.ownerUserId,
          entityType: 'stock',
          recordKey: `${r.cin7BranchId}:${r.sku}`,
          beforeJson: {
            cin7BranchId: r.cin7BranchId,
            sku: r.sku,
            branchName: r.branchName,
            available: r.available,
            stockOnHand: r.stockOnHand,
            incoming: r.incoming,
            openSales: r.openSales,
          } as Prisma.InputJsonValue,
        })),
      },
    },
    select: { id: true },
  });

  const result = await pruneOptixStockLevelsToCin7(input.ownerUserId, input.omniCreds, {
    dryRun: false,
  });

  await prisma.cin7HealAuditRun.update({
    where: { id: audit.id },
    data: {
      deletedTotal: result.deleted,
      status: result.errors.length > 0 && result.deleted === 0 ? 'failed' : 'applied',
      summary: {
        ...result,
        note: 'Explicit stock prune — deletes Optix rows absent from Cin7. Reversible from audit.',
      } as unknown as Prisma.InputJsonValue,
    },
  });

  return { audit_run_id: audit.id, ...result };
}

/** Restore Optix rows from a prior heal/prune audit (best-effort reverse). */
export async function revertHealAuditRun(input: {
  ownerUserId: string;
  actorUserId: string;
  auditRunId: string;
}): Promise<{ reverted: number; action_type: string }> {
  const run = await prisma.cin7HealAuditRun.findFirst({
    where: { id: input.auditRunId, ownerUserId: input.ownerUserId },
    include: { rows: { where: { revertedAt: null } } },
  });
  if (!run) throw new Error('Heal audit run not found');
  if (run.status === 'reverted') throw new Error('This repair was already reverted');
  if (run.rows.length === 0) throw new Error('No reversible rows in this audit run');

  let reverted = 0;

  if (run.actionType === 'field_heal') {
    const products = run.rows.filter((r) => r.entityType === 'products');
    const customers = run.rows.filter((r) => r.entityType === 'customers');
    const stock = run.rows.filter((r) => r.entityType === 'stock');

    if (products.length) {
      await batchUpsertProducts(
        input.ownerUserId,
        mapOmniProductRows(
          products.map((r) => {
            const b = r.beforeJson as Record<string, unknown>;
            return {
              sku: String(b.sku ?? r.recordKey),
              name: String(b.name ?? r.recordKey),
              price: Number(b.price ?? 0),
              stock: Number(b.stock ?? 0),
              visibility: String(b.cin7Visibility ?? 'Unknown'),
              isActive: Boolean(b.isActive ?? true),
              styleCode: b.cin7StyleCode ? String(b.cin7StyleCode) : undefined,
            };
          })
        )
      );
      reverted += products.length;
    }

    if (customers.length) {
      await batchUpsertCustomers(
        input.ownerUserId,
        mapOmniCustomerRows(
          customers.map((r) => {
            const b = r.beforeJson as Record<string, unknown>;
            return {
              cin7ContactId: String(b.cin7ContactId ?? r.recordKey),
              contactType: String(b.cin7ContactType ?? 'Customer'),
              companyName: String(b.companyName ?? ''),
              email: String(b.email ?? ''),
              phone: b.phone ? String(b.phone) : undefined,
              city: b.city ? String(b.city) : undefined,
            };
          })
        )
      );
      reverted += customers.length;
    }

    if (stock.length) {
      await batchUpsertStockLevels(
        input.ownerUserId,
        mapOmniStockLevelRows(
          stock.map((r) => {
            const b = r.beforeJson as Record<string, unknown>;
            return {
              cin7BranchId: String(b.cin7BranchId ?? ''),
              sku: String(b.sku ?? ''),
              branchName: b.branchName ? String(b.branchName) : undefined,
              available: Number(b.available ?? 0),
              stockOnHand: Number(b.stockOnHand ?? 0),
              incoming: Number(b.incoming ?? 0),
              openSales: Number(b.openSales ?? 0),
            };
          })
        )
      );
      reverted += stock.length;
    }
  } else if (run.actionType === 'stock_prune') {
    // Re-create deleted surplus rows from beforeJson
    const stock = run.rows.filter((r) => r.entityType === 'stock');
    if (stock.length) {
      await batchUpsertStockLevels(
        input.ownerUserId,
        mapOmniStockLevelRows(
          stock.map((r) => {
            const b = r.beforeJson as Record<string, unknown>;
            return {
              cin7BranchId: String(b.cin7BranchId ?? ''),
              sku: String(b.sku ?? ''),
              branchName: b.branchName ? String(b.branchName) : undefined,
              available: Number(b.available ?? 0),
              stockOnHand: Number(b.stockOnHand ?? 0),
              incoming: Number(b.incoming ?? 0),
              openSales: Number(b.openSales ?? 0),
            };
          })
        )
      );
      reverted += stock.length;
    }
  } else {
    throw new Error(`Unsupported action type for revert: ${run.actionType}`);
  }

  const now = new Date();
  await prisma.$transaction([
    prisma.cin7HealAuditRow.updateMany({
      where: { healRunId: run.id, revertedAt: null },
      data: { revertedAt: now },
    }),
    prisma.cin7HealAuditRun.update({
      where: { id: run.id },
      data: {
        status: 'reverted',
        revertedAt: now,
        revertedByUserId: input.actorUserId,
      },
    }),
  ]);

  return { reverted, action_type: run.actionType };
}
