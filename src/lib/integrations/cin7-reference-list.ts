import { prisma } from '@/lib/db/prisma';

export const CIN7_REFERENCE_LIST_ENTITIES = [
  'product-categories',
  'brands',
  'price-lists',
  'tax-codes',
  'units-of-measure',
  'stock-levels',
  'warehouses',
] as const;

export type Cin7ReferenceListEntity = (typeof CIN7_REFERENCE_LIST_ENTITIES)[number];

export function isCin7ReferenceListEntity(entity: string): entity is Cin7ReferenceListEntity {
  return (CIN7_REFERENCE_LIST_ENTITIES as readonly string[]).includes(entity);
}

type ListParams = {
  ownerUserId: string;
  page: number;
  pageSize: number;
  search?: string;
};

export async function listCin7ReferenceData(
  entity: Cin7ReferenceListEntity,
  params: ListParams
): Promise<{ items: Record<string, unknown>[]; total: number }> {
  const { ownerUserId, page, pageSize, search } = params;
  const skip = (page - 1) * pageSize;

  if (entity === 'product-categories') {
    const where = {
      ownerUserId,
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: 'insensitive' as const } },
              { cin7CategoryId: { contains: search, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    };
    const [rows, total] = await Promise.all([
      prisma.cin7ProductCategory.findMany({
        where,
        orderBy: [{ sort: 'asc' }, { name: 'asc' }],
        skip,
        take: pageSize,
      }),
      prisma.cin7ProductCategory.count({ where }),
    ]);
    return {
      total,
      items: rows.map((row) => ({
        id: row.id,
        cin7_category_id: row.cin7CategoryId,
        parent_cin7_category_id: row.parentCin7CategoryId,
        name: row.name,
        description: row.description,
        sort: row.sort,
        is_active: row.isActive,
        updated_at: row.updatedAt.toISOString(),
      })),
    };
  }

  if (entity === 'brands') {
    const where = {
      ownerUserId,
      ...(search ? { name: { contains: search, mode: 'insensitive' as const } } : {}),
    };
    const [rows, total] = await Promise.all([
      prisma.cin7Brand.findMany({ where, orderBy: { name: 'asc' }, skip, take: pageSize }),
      prisma.cin7Brand.count({ where }),
    ]);
    return {
      total,
      items: rows.map((row) => ({
        id: row.id,
        name: row.name,
        is_active: row.isActive,
        updated_at: row.updatedAt.toISOString(),
      })),
    };
  }

  if (entity === 'price-lists') {
    const where = {
      ownerUserId,
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: 'insensitive' as const } },
              { cin7PriceColumn: { contains: search, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    };
    const [rows, total] = await Promise.all([
      prisma.cin7PriceList.findMany({ where, orderBy: { name: 'asc' }, skip, take: pageSize }),
      prisma.cin7PriceList.count({ where }),
    ]);
    return {
      total,
      items: rows.map((row) => ({
        id: row.id,
        cin7_price_column: row.cin7PriceColumn,
        name: row.name,
        is_active: row.isActive,
        updated_at: row.updatedAt.toISOString(),
      })),
    };
  }

  if (entity === 'tax-codes') {
    const where = {
      ownerUserId,
      ...(search
        ? {
            OR: [
              { code: { contains: search, mode: 'insensitive' as const } },
              { name: { contains: search, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    };
    const [rows, total] = await Promise.all([
      prisma.cin7TaxCode.findMany({ where, orderBy: { code: 'asc' }, skip, take: pageSize }),
      prisma.cin7TaxCode.count({ where }),
    ]);
    return {
      total,
      items: rows.map((row) => ({
        id: row.id,
        code: row.code,
        name: row.name,
        is_active: row.isActive,
        updated_at: row.updatedAt.toISOString(),
      })),
    };
  }

  if (entity === 'units-of-measure') {
    const where = {
      ownerUserId,
      ...(search
        ? {
            OR: [
              { code: { contains: search, mode: 'insensitive' as const } },
              { name: { contains: search, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    };
    const [rows, total] = await Promise.all([
      prisma.cin7UnitOfMeasure.findMany({ where, orderBy: { code: 'asc' }, skip, take: pageSize }),
      prisma.cin7UnitOfMeasure.count({ where }),
    ]);
    return {
      total,
      items: rows.map((row) => ({
        id: row.id,
        code: row.code,
        name: row.name,
        is_active: row.isActive,
        updated_at: row.updatedAt.toISOString(),
      })),
    };
  }

  if (entity === 'stock-levels') {
    const where = {
      ownerUserId,
      ...(search
        ? {
            OR: [
              { sku: { contains: search, mode: 'insensitive' as const } },
              { branchName: { contains: search, mode: 'insensitive' as const } },
              { cin7BranchId: { contains: search, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    };
    const [rows, total] = await Promise.all([
      prisma.cin7StockLevel.findMany({
        where,
        orderBy: [{ sku: 'asc' }, { branchName: 'asc' }],
        skip,
        take: pageSize,
      }),
      prisma.cin7StockLevel.count({ where }),
    ]);
    return {
      total,
      items: rows.map((row) => ({
        id: row.id,
        sku: row.sku,
        cin7_branch_id: row.cin7BranchId,
        branch_name: row.branchName,
        available: row.available,
        stock_on_hand: row.stockOnHand,
        incoming: row.incoming,
        open_sales: row.openSales,
        updated_at: row.updatedAt.toISOString(),
      })),
    };
  }

  // warehouses — Cin7 Omni stores warehouse sites as branches
  const where = {
    ownerUserId,
    ...(search
      ? {
          OR: [
            { name: { contains: search, mode: 'insensitive' as const } },
            { city: { contains: search, mode: 'insensitive' as const } },
            { cin7BranchId: { contains: search, mode: 'insensitive' as const } },
          ],
        }
      : {}),
  };
  const [rows, total] = await Promise.all([
    prisma.cin7Branch.findMany({ where, orderBy: { name: 'asc' }, skip, take: pageSize }),
    prisma.cin7Branch.count({ where }),
  ]);
  return {
    total,
    items: rows.map((row) => ({
      id: row.id,
      cin7_branch_id: row.cin7BranchId,
      name: row.name,
      branch_type: row.branchType,
      city: row.city,
      state: row.state,
      post_code: row.postCode,
      is_active: row.isActive,
      updated_at: row.updatedAt.toISOString(),
    })),
  };
}
