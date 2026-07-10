'use client';

import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import {
  BadgePercent,
  Boxes,
  FolderTree,
  Receipt,
  Ruler,
  Tags,
  Warehouse,
} from 'lucide-react';

import type { Cin7SyncEntity } from '@/components/integrations/Cin7SyncButton';
import type { Cin7ReferenceListEntity } from '@/lib/integrations/cin7-reference-list';

export type Cin7ReferenceColumn = {
  key: string;
  label: string;
  mono?: boolean;
  render?: (row: Record<string, unknown>) => ReactNode;
};

export type Cin7ReferencePageConfig = {
  entity: Cin7ReferenceListEntity;
  syncEntity: Cin7SyncEntity;
  navKey: Cin7SyncEntity;
  label: string;
  title: string;
  subtitle: string;
  href: string;
  icon: LucideIcon;
  module: 'inventory';
  searchPlaceholder: string;
  emptyTitle: string;
  emptyDescription: string;
  columns: Cin7ReferenceColumn[];
};

function activeBadge(value: unknown) {
  const active = value === true;
  return active ? 'Active' : 'Inactive';
}

export const CIN7_REFERENCE_PAGE_CONFIGS: Record<Cin7ReferenceListEntity, Cin7ReferencePageConfig> =
  {
    'product-categories': {
      entity: 'product-categories',
      syncEntity: 'product-categories',
      navKey: 'product-categories',
      label: 'Categories',
      title: 'Cin7 product categories',
      subtitle: 'Category tree synced from Cin7 Omni /v1/ProductCategories',
      href: '/dashboard/inventory/product-categories',
      icon: FolderTree,
      module: 'inventory',
      searchPlaceholder: 'Search categories…',
      emptyTitle: 'No product categories yet',
      emptyDescription:
        'Sync from Cin7 to import your full category tree, including inactive categories.',
      columns: [
        { key: 'name', label: 'Name' },
        { key: 'cin7_category_id', label: 'Cin7 ID', mono: true },
        { key: 'parent_cin7_category_id', label: 'Parent ID', mono: true },
        { key: 'sort', label: 'Sort' },
        { key: 'is_active', label: 'Status', render: (row) => activeBadge(row.is_active) },
      ],
    },
    brands: {
      entity: 'brands',
      syncEntity: 'brands',
      navKey: 'brands',
      label: 'Brands',
      title: 'Cin7 brands',
      subtitle: 'Distinct product brands derived from the Cin7 product catalog',
      href: '/dashboard/inventory/brands',
      icon: Tags,
      module: 'inventory',
      searchPlaceholder: 'Search brands…',
      emptyTitle: 'No brands yet',
      emptyDescription: 'Sync from Cin7 to extract all product brand names currently in use.',
      columns: [
        { key: 'name', label: 'Brand' },
        { key: 'is_active', label: 'Status', render: (row) => activeBadge(row.is_active) },
      ],
    },
    'price-lists': {
      entity: 'price-lists',
      syncEntity: 'price-lists',
      navKey: 'price-lists',
      label: 'Price lists',
      title: 'Cin7 price lists',
      subtitle: 'Price columns from Cin7 products and customer price lists',
      href: '/dashboard/inventory/price-lists',
      icon: BadgePercent,
      module: 'inventory',
      searchPlaceholder: 'Search price lists…',
      emptyTitle: 'No price lists yet',
      emptyDescription:
        'Sync from Cin7 to import all price column definitions used on products and customers.',
      columns: [
        { key: 'name', label: 'Label' },
        { key: 'cin7_price_column', label: 'Cin7 column', mono: true },
        { key: 'is_active', label: 'Status', render: (row) => activeBadge(row.is_active) },
      ],
    },
    'tax-codes': {
      entity: 'tax-codes',
      syncEntity: 'tax-codes',
      navKey: 'tax-codes',
      label: 'Tax codes',
      title: 'Cin7 tax codes',
      subtitle: 'Tax status values from Cin7 contacts and branches',
      href: '/dashboard/inventory/tax-codes',
      icon: Receipt,
      module: 'inventory',
      searchPlaceholder: 'Search tax codes…',
      emptyTitle: 'No tax codes yet',
      emptyDescription: 'Sync from Cin7 to import tax status codes used across your master data.',
      columns: [
        { key: 'code', label: 'Code', mono: true },
        { key: 'name', label: 'Name' },
        { key: 'is_active', label: 'Status', render: (row) => activeBadge(row.is_active) },
      ],
    },
    'units-of-measure': {
      entity: 'units-of-measure',
      syncEntity: 'units-of-measure',
      navKey: 'units-of-measure',
      label: 'UOM',
      title: 'Cin7 units of measure',
      subtitle: 'Product option units (e.g. EACH) from the Cin7 catalog',
      href: '/dashboard/inventory/units-of-measure',
      icon: Ruler,
      module: 'inventory',
      searchPlaceholder: 'Search units…',
      emptyTitle: 'No units of measure yet',
      emptyDescription: 'Sync from Cin7 to import all unit codes used on product variants.',
      columns: [
        { key: 'code', label: 'Code', mono: true },
        { key: 'name', label: 'Name' },
        { key: 'is_active', label: 'Status', render: (row) => activeBadge(row.is_active) },
      ],
    },
    'stock-levels': {
      entity: 'stock-levels',
      syncEntity: 'stock-levels',
      navKey: 'stock-levels',
      label: 'Stock',
      title: 'Cin7 stock levels',
      subtitle: 'Per-branch SKU quantities from Cin7 Omni /v1/Stock',
      href: '/dashboard/inventory/stock-levels',
      icon: Boxes,
      module: 'inventory',
      searchPlaceholder: 'Search SKU or branch…',
      emptyTitle: 'No stock levels yet',
      emptyDescription:
        'Sync from Cin7 to import warehouse stock quantities for every branch and SKU combination.',
      columns: [
        { key: 'sku', label: 'SKU', mono: true },
        { key: 'branch_name', label: 'Branch' },
        { key: 'cin7_branch_id', label: 'Branch ID', mono: true },
        { key: 'available', label: 'Available' },
        { key: 'stock_on_hand', label: 'On hand' },
        { key: 'incoming', label: 'Incoming' },
        { key: 'open_sales', label: 'Open sales' },
      ],
    },
    warehouses: {
      entity: 'warehouses',
      syncEntity: 'warehouses',
      navKey: 'warehouses',
      label: 'Warehouses',
      title: 'Cin7 warehouses',
      subtitle: 'Warehouse sites in Cin7 Omni are stored as branches — synced as-is',
      href: '/dashboard/inventory/warehouses',
      icon: Warehouse,
      module: 'inventory',
      searchPlaceholder: 'Search warehouses…',
      emptyTitle: 'No warehouses yet',
      emptyDescription:
        'Sync from Cin7 to import warehouse branch locations. Cin7 Omni maps warehouses to the Branches API.',
      columns: [
        { key: 'name', label: 'Warehouse' },
        { key: 'cin7_branch_id', label: 'Cin7 ID', mono: true },
        { key: 'branch_type', label: 'Type' },
        {
          key: 'city',
          label: 'Location',
          render: (row) =>
            [row.city, row.state, row.post_code].filter(Boolean).join(', ') || '—',
        },
        { key: 'is_active', label: 'Status', render: (row) => activeBadge(row.is_active) },
      ],
    },
  };

export const CIN7_REFERENCE_VERIFY_PAGES = Object.values(CIN7_REFERENCE_PAGE_CONFIGS);
