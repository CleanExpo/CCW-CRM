import type { Cin7OmniCredentials } from '@/lib/integrations/cin7-omni';
import {
  fetchOmniBranchesPage,
  fetchOmniContactsPage,
  fetchOmniProductCategoriesPage,
  fetchOmniProductPage,
  fetchOmniStockPage,
} from '@/lib/integrations/cin7-omni';
import { getCin7PageSize } from '@/lib/integrations/cin7-sync-config';
import {
  runPagedOmniSync,
  type Cin7PagedSyncResult,
} from '@/lib/integrations/cin7-sync-pagination';
import {
  batchUpsertBranches,
  batchUpsertCustomers,
  batchUpsertProductCategories,
  batchUpsertProducts,
  batchUpsertStockLevels,
  batchUpsertSuppliers,
  mapOmniBranchRows,
  mapOmniCustomerRows,
  mapOmniProductRows,
  mapOmniStockLevelRows,
  mapOmniSupplierRows,
  type Cin7SyncSkipInput,
} from '@/lib/integrations/cin7-sync-persist';

export type Cin7OmniSyncOutcome = Cin7PagedSyncResult & {
  skipped: {
    wrong_contact_type: number;
    missing_cin7_id: number;
    inactive_products: number;
  };
  skipRecords: Cin7SyncSkipInput[];
  cin7SourceStyles?: number;
};

function emptySkipped() {
  return {
    wrong_contact_type: 0,
    missing_cin7_id: 0,
    inactive_products: 0,
  };
}

export async function syncOmniProducts(
  creds: Cin7OmniCredentials,
  ownerUserId: string,
  startPage?: number
): Promise<Cin7OmniSyncOutcome> {
  const skipped = emptySkipped();
  let cin7SourceStyles = 0;
  const pageSize = getCin7PageSize();

  const result = await runPagedOmniSync({
    startPage,
    fetchPage: async (page) => {
      const r = await fetchOmniProductPage(creds, page, pageSize, { excludeInactive: false });
      cin7SourceStyles += r.sourceRowCount;
      return {
        items: r.rows,
        sourceRowCount: r.sourceRowCount,
        meta: { skippedInactive: r.skippedInactive },
        error: r.error,
      };
    },
    onPageMeta: (meta) => {
      skipped.inactive_products += meta.skippedInactive ?? 0;
    },
    persistPage: async (items) => batchUpsertProducts(ownerUserId, mapOmniProductRows(items)),
  });

  return { ...result, skipped, skipRecords: [], cin7SourceStyles };
}

export async function syncOmniContacts(
  creds: Cin7OmniCredentials,
  ownerUserId: string,
  contactType: 'Customer' | 'Supplier' | 'Internal',
  startPage?: number
): Promise<Cin7OmniSyncOutcome> {
  const skipped = emptySkipped();
  const skipRecords: Cin7SyncSkipInput[] = [];
  const pageSize = getCin7PageSize();

  const result = await runPagedOmniSync({
    startPage,
    fetchPage: async (page) => {
      const r = await fetchOmniContactsPage(creds, page, pageSize, { whereType: contactType });
      for (const record of r.skippedRecords) {
        skipRecords.push({
          cin7Id: record.cin7Id ?? `page-${page}-missing-id`,
          label: record.label,
          reason: record.reason,
        });
      }
      return {
        items: r.rows,
        sourceRowCount: r.sourceRowCount,
        meta: {
          skippedMissingId: r.skippedMissingId,
          skippedWrongType: r.skippedWrongType,
        },
        error: r.error,
      };
    },
    onPageMeta: (meta) => {
      skipped.missing_cin7_id += meta.skippedMissingId ?? 0;
      skipped.wrong_contact_type += meta.skippedWrongType ?? 0;
    },
    persistPage: async (items) => {
      if (contactType === 'Supplier') {
        return batchUpsertSuppliers(ownerUserId, mapOmniSupplierRows(items));
      }
      return batchUpsertCustomers(ownerUserId, mapOmniCustomerRows(items));
    },
  });

  return { ...result, skipped, skipRecords };
}

export async function syncOmniBranches(
  creds: Cin7OmniCredentials,
  ownerUserId: string,
  startPage?: number
): Promise<Cin7OmniSyncOutcome> {
  const skipped = emptySkipped();
  const pageSize = getCin7PageSize();

  const result = await runPagedOmniSync({
    startPage,
    fetchPage: async (page) => {
      const r = await fetchOmniBranchesPage(creds, page, pageSize);
      return {
        items: r.rows,
        sourceRowCount: r.sourceRowCount,
        meta: { skippedMissingId: r.skippedMissingId },
        error: r.error,
      };
    },
    onPageMeta: (meta) => {
      skipped.missing_cin7_id += meta.skippedMissingId ?? 0;
    },
    persistPage: async (items) => batchUpsertBranches(ownerUserId, mapOmniBranchRows(items)),
  });

  return { ...result, skipped, skipRecords: [] };
}

export async function syncOmniStockLevels(
  creds: Cin7OmniCredentials,
  ownerUserId: string,
  startPage?: number
): Promise<Cin7OmniSyncOutcome> {
  const skipped = emptySkipped();
  const pageSize = getCin7PageSize();

  const result = await runPagedOmniSync({
    startPage,
    fetchPage: async (page) => {
      const r = await fetchOmniStockPage(creds, page, pageSize);
      return { items: r.rows, sourceRowCount: r.sourceRowCount, error: r.error };
    },
    persistPage: async (items) => batchUpsertStockLevels(ownerUserId, mapOmniStockLevelRows(items)),
  });

  return { ...result, skipped, skipRecords: [] };
}

export async function syncOmniProductCategories(
  creds: Cin7OmniCredentials,
  ownerUserId: string,
  startPage?: number
): Promise<Cin7OmniSyncOutcome> {
  const skipped = emptySkipped();
  const pageSize = getCin7PageSize();

  const result = await runPagedOmniSync({
    startPage,
    fetchPage: async (page) => {
      const r = await fetchOmniProductCategoriesPage(creds, page, pageSize);
      return { items: r.rows, sourceRowCount: r.sourceRowCount, error: r.error };
    },
    persistPage: async (items) => batchUpsertProductCategories(ownerUserId, items),
  });

  return { ...result, skipped, skipRecords: [] };
}
