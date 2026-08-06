import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/db/prisma', () => {
  return {
    prisma: {
      product: { findMany: vi.fn().mockResolvedValue([]) },
      customer: { count: vi.fn() },
      supplier: { count: vi.fn() },
      cin7Branch: { count: vi.fn().mockResolvedValue(0) },
    },
  };
});

vi.mock('@/lib/integrations/cin7-reconciliation-reference', () => ({
  getOptixReferenceCounts: vi.fn().mockResolvedValue({
    product_categories: 0,
    brands: 0,
    price_lists: 0,
    tax_codes: 0,
    units_of_measure: 0,
    stock_levels: 0,
  }),
}));

import { prisma } from '@/lib/db/prisma';
import { loadOptixCounts } from '@/lib/integrations/cin7-reconciliation-job';

describe('loadOptixCounts customer extra_without_cin7_id', () => {
  it('does not count linked Internal contacts as extra-without-id Customers', async () => {
    // Fixture: 3 linked Customer/null rows, 2 linked Internal rows.
    // customerTotal (all types) = 5, customerLinked (Customer/null only) = 3,
    // customerExtraWithoutId (unlinked Customer/null) = 0, internalCount = 2.
    // A regression that computes extra = total - linked would wrongly return 2.
    const customerCountMock = prisma.customer.count as unknown as ReturnType<typeof vi.fn>;
    customerCountMock.mockImplementation(async (args: { where: Record<string, unknown> }) => {
      const where = args.where;
      if (where.cin7ContactType && (where.cin7ContactType as { equals: string }).equals === 'Internal') {
        return 2; // internalCount
      }
      if (where.cin7ContactId === null) {
        return 0; // customerExtraWithoutId: unlinked Customer/null rows
      }
      if (
        where.cin7ContactId &&
        (where.cin7ContactId as { not: null }).not === null
      ) {
        return 3; // customerLinked: linked Customer/null rows
      }
      return 5; // customerTotal: all customer rows regardless of type/link
    });
    const supplierCountMock = prisma.supplier.count as unknown as ReturnType<typeof vi.fn>;
    supplierCountMock.mockResolvedValue(0);

    const counts = await loadOptixCounts('owner-1');

    expect(counts.customers.total).toBe(5);
    expect(counts.customers.cin7_linked).toBe(3);
    expect(counts.customers.extra_without_cin7_id).toBe(0);
    expect(counts.internal_customers).toBe(2);
  });
});
