/** Cin7 Phase 1 master data entity keys — sync + reconciliation. */
export const CIN7_MASTER_ENTITY_TYPES = [
  'products',
  'customers',
  'internal-customers',
  'suppliers',
  'branches',
  'warehouses',
  'product-categories',
  'brands',
  'price-lists',
  'tax-codes',
  'units-of-measure',
  'stock-levels',
] as const;

export type Cin7MasterEntityType = (typeof CIN7_MASTER_ENTITY_TYPES)[number];

export const CIN7_SYNCABLE_ENTITY_TYPES = [
  ...CIN7_MASTER_ENTITY_TYPES,
  'orders',
  'inventory',
] as const;

export type Cin7SyncableEntityType = (typeof CIN7_SYNCABLE_ENTITY_TYPES)[number];

export const CIN7_REFERENCE_ENTITY_TYPES = [
  'product-categories',
  'brands',
  'price-lists',
  'tax-codes',
  'units-of-measure',
  'stock-levels',
] as const;

export type Cin7ReferenceEntityType = (typeof CIN7_REFERENCE_ENTITY_TYPES)[number];

export function isCin7ReferenceEntity(entity: string): entity is Cin7ReferenceEntityType {
  return (CIN7_REFERENCE_ENTITY_TYPES as readonly string[]).includes(entity);
}

/** Cin7 Omni uses Branches for warehouse sites — warehouses sync reuses branches. */
export function resolveCin7SyncEntityAlias(entity: string): string {
  if (entity === 'warehouses') return 'branches';
  if (entity === 'inventory') return 'stock-levels';
  return entity;
}

export function formatCin7PriceColumnLabel(column: string): string {
  return column
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/AUD|USD|Inc/g, (m) => m.toUpperCase())
    .replace(/^./, (c) => c.toUpperCase());
}
