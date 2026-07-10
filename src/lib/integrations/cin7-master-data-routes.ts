import type { LucideIcon } from 'lucide-react';
import {
  BadgePercent,
  Boxes,
  Building2,
  FolderTree,
  Link2,
  MapPin,
  Package,
  Receipt,
  RefreshCw,
  Ruler,
  ShoppingCart,
  Tags,
  Truck,
  Users,
  Warehouse,
} from 'lucide-react';

import type { Cin7SyncEntity } from '@/components/integrations/Cin7SyncButton';

export const CIN7_INTEGRATIONS_URL = '/dashboard/settings/integrations';
export const CIN7_INTEGRATIONS_ANCHOR = `${CIN7_INTEGRATIONS_URL}#integration-cin7`;
export const CIN7_SETUP_GUIDE_URL = `${CIN7_INTEGRATIONS_URL}?tab=setup`;
export const CIN7_MASTER_DATA_HUB_URL = '/dashboard/inventory/cin7';

export type Cin7VerifyPage = {
  key: Cin7SyncEntity;
  label: string;
  description: string;
  href: string;
  icon: LucideIcon;
  module: 'inventory' | 'crm' | 'operations';
};

const CORE_VERIFY_PAGES: Cin7VerifyPage[] = [
  {
    key: 'products',
    label: 'Products',
    description: 'SKU catalogue from Cin7',
    href: '/dashboard/inventory/products',
    icon: Package,
    module: 'inventory',
  },
  {
    key: 'customers',
    label: 'Customers',
    description: 'CRM accounts linked by Cin7 id',
    href: '/dashboard/crm/customers',
    icon: Users,
    module: 'crm',
  },
  {
    key: 'internal-customers',
    label: 'Internal customers',
    description: 'Inter-branch and internal accounts',
    href: '/dashboard/crm/internal-customers',
    icon: Building2,
    module: 'crm',
  },
  {
    key: 'suppliers',
    label: 'Suppliers',
    description: 'Vendor directory from Cin7',
    href: '/dashboard/inventory/suppliers',
    icon: Truck,
    module: 'inventory',
  },
  {
    key: 'branches',
    label: 'Branches',
    description: 'Branch locations from Cin7',
    href: '/dashboard/inventory/branches',
    icon: MapPin,
    module: 'inventory',
  },
];

const REFERENCE_VERIFY_PAGES: Cin7VerifyPage[] = [
  {
    key: 'warehouses',
    label: 'Warehouses',
    description: 'Warehouse sites from Cin7 (stored as branches)',
    href: '/dashboard/inventory/warehouses',
    icon: Warehouse,
    module: 'inventory',
  },
  {
    key: 'product-categories',
    label: 'Categories',
    description: 'Product category tree from Cin7',
    href: '/dashboard/inventory/product-categories',
    icon: FolderTree,
    module: 'inventory',
  },
  {
    key: 'brands',
    label: 'Brands',
    description: 'Product brands from Cin7',
    href: '/dashboard/inventory/brands',
    icon: Tags,
    module: 'inventory',
  },
  {
    key: 'price-lists',
    label: 'Price lists',
    description: 'Cin7 price columns and price lists',
    href: '/dashboard/inventory/price-lists',
    icon: BadgePercent,
    module: 'inventory',
  },
  {
    key: 'tax-codes',
    label: 'Tax codes',
    description: 'Tax status codes from Cin7',
    href: '/dashboard/inventory/tax-codes',
    icon: Receipt,
    module: 'inventory',
  },
  {
    key: 'units-of-measure',
    label: 'UOM',
    description: 'Units of measure from Cin7 products',
    href: '/dashboard/inventory/units-of-measure',
    icon: Ruler,
    module: 'inventory',
  },
  {
    key: 'stock-levels',
    label: 'Stock',
    description: 'Per-branch SKU stock from Cin7',
    href: '/dashboard/inventory/stock-levels',
    icon: Boxes,
    module: 'inventory',
  },
];

const TAIL_VERIFY_PAGES: Cin7VerifyPage[] = [
  {
    key: 'inventory',
    label: 'Inventory',
    description: 'Local inventory overview and health',
    href: '/dashboard/inventory',
    icon: Boxes,
    module: 'inventory',
  },
  {
    key: 'orders',
    label: 'Sales orders',
    description: 'Order pipeline from Cin7',
    href: '/dashboard/operations/orders',
    icon: ShoppingCart,
    module: 'operations',
  },
];

/** Pages where synced Cin7 master data can be reviewed and manually re-synced. */
export const CIN7_VERIFY_PAGES: Cin7VerifyPage[] = [
  ...CORE_VERIFY_PAGES,
  ...REFERENCE_VERIFY_PAGES,
  ...TAIL_VERIFY_PAGES,
];

export const CIN7_FLOW_STEPS = [
  {
    step: 1,
    title: 'Connect Cin7',
    description: 'Add Omni credentials under Integrations and confirm the connection.',
    href: CIN7_INTEGRATIONS_ANCHOR,
    icon: Link2,
    cta: 'Open integrations',
  },
  {
    step: 2,
    title: 'Sync & reconcile',
    description: 'Run full syncs and compare live Cin7 counts with Optix.',
    href: CIN7_INTEGRATIONS_ANCHOR,
    icon: RefreshCw,
    cta: 'Sync & compare',
  },
  {
    step: 3,
    title: 'Verify in your modules',
    description: 'Open each area below to confirm data landed correctly.',
    href: CIN7_MASTER_DATA_HUB_URL,
    icon: Package,
    cta: 'Browse Cin7 data',
  },
] as const;

export function getCin7VerifyPage(key: Cin7SyncEntity): Cin7VerifyPage | undefined {
  return CIN7_VERIFY_PAGES.find((page) => page.key === key);
}
