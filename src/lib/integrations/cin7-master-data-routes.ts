import type { LucideIcon } from 'lucide-react';
import {
  Boxes,
  Building2,
  Link2,
  MapPin,
  Package,
  RefreshCw,
  ShoppingCart,
  Truck,
  Users,
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

/** Pages where synced Cin7 master data can be reviewed and manually re-synced. */
export const CIN7_VERIFY_PAGES: Cin7VerifyPage[] = [
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
    description: 'Warehouse and branch locations',
    href: '/dashboard/inventory/branches',
    icon: MapPin,
    module: 'inventory',
  },
  {
    key: 'inventory',
    label: 'Stock levels',
    description: 'Warehouse quantities and health',
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
