'use client';

import { NotificationBell } from '@/components/layout/NotificationBell';
import { authApi, logoutAndRedirectToLogin } from '@/lib/api/auth';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';
import {
  AlertCircle,
  BarChart3,
  Bell,
  Bot,
  Calendar,
  CalendarDays,
  CheckCircle,
  ChevronDown,
  ChevronRight,
  ClipboardList,
  CreditCard,
  Eye,
  Factory,
  FileText,
  GitBranch,
  GitMerge,
  HardHat,
  HeartPulse,
  Inbox,
  Landmark,
  Layers,
  LayoutDashboard,
  LogOut,
  Mail,
  Package,
  PackageCheck,
  PackagePlus,
  PackageSearch,
  Receipt,
  Scale,
  Settings,
  Ship,
  ShoppingCart,
  Store,
  Tag,
  Timer,
  Truck,
  UserCircle,
  Users,
  Warehouse,
  Wrench,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';

interface NavItem {
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  /** When true, item is visible but not linked (placeholder). */
  comingSoon?: boolean;
}

interface NavGroup {
  id: string;
  label: string;
  items: NavItem[];
}

const navGroups: NavGroup[] = [
  {
    id: 'operations',
    label: 'Operations',
    items: [
      { name: 'Quotes', href: '/dashboard/operations/quotes', icon: FileText },
      { name: 'Sales orders', href: '/dashboard/operations/orders', icon: ShoppingCart },
      { name: 'Fulfilment', href: '/dashboard/operations/fulfilment', icon: PackageCheck },
      {
        name: 'Purchase orders',
        href: '/dashboard/operations/purchase-orders',
        icon: ClipboardList,
      },
      {
        name: 'Receiving',
        href: '/dashboard/operations/purchase-orders/receiving',
        icon: PackagePlus,
      },
      { name: 'Point of sale', href: '/dashboard/operations/pos', icon: Store },
      {
        name: 'POS reconciliation',
        href: '/dashboard/operations/pos/reconciliation',
        icon: Scale,
      },
      {
        name: 'Inbound enquiries',
        href: '/dashboard/operations/submissions',
        icon: Inbox,
      },
    ],
  },
  {
    id: 'crm',
    label: 'CRM',
    items: [
      { name: 'Overview', href: '/dashboard/crm', icon: LayoutDashboard },
      { name: 'Customers', href: '/dashboard/crm/customers', icon: Users },
      { name: 'Client Health', href: '/dashboard/crm/client-health', icon: HeartPulse },
      { name: 'Onboarding', href: '/dashboard/crm/onboarding', icon: GitBranch },
      { name: 'Personas', href: '/dashboard/crm/personas', icon: Tag },
      { name: 'Contacts', href: '/dashboard/crm/contacts', icon: UserCircle },
      { name: 'Contractors', href: '/dashboard/crm/contractors', icon: HardHat },
      { name: 'Service Requests', href: '/dashboard/crm/service-requests', icon: Wrench },
      { name: 'Activities', href: '/dashboard/crm/activities', icon: Calendar },
    ],
  },
  {
    id: 'workshop',
    label: 'Workshop',
    items: [
      { name: 'Overview', href: '/dashboard/workshop', icon: LayoutDashboard },
      { name: 'Schedule', href: '/dashboard/workshop/schedule', icon: CalendarDays },
      { name: 'Equipment', href: '/dashboard/workshop/equipment', icon: Factory },
      { name: 'Job templates', href: '/dashboard/workshop/templates', icon: ClipboardList },
      { name: 'Reminders', href: '/dashboard/workshop/reminders', icon: Bell },
    ],
  },
  {
    id: 'inventory',
    label: 'Inventory',
    items: [
      { name: 'Products', href: '/dashboard/inventory/products', icon: Package },
      { name: 'Inventory Overview', href: '/dashboard/inventory', icon: Warehouse },
      { name: 'Bill of Materials', href: '/dashboard/inventory/bom', icon: Layers },
      { name: 'Stock List', href: '/dashboard/inventory/stock', icon: PackageSearch },
      { name: 'Stock Transfers', href: '/dashboard/inventory/transfers', icon: PackageCheck },
      { name: 'Reservations', href: '/dashboard/inventory/reservations', icon: Timer },
      { name: 'Stock Forecast', href: '/dashboard/inventory/forecast', icon: BarChart3 },
      { name: 'Warehouse Ops', href: '/dashboard/inventory/warehouse', icon: Truck },
      { name: 'Containers', href: '/dashboard/inventory/containers', icon: Ship },
      { name: 'Backorders', href: '/dashboard/inventory/backorders', icon: AlertCircle },
    ],
  },
  {
    id: 'finance',
    label: 'Finance',
    items: [
      { name: 'Invoices', href: '/dashboard/finance/invoices', icon: Receipt },
      { name: 'BAS Report', href: '/dashboard/finance/invoices/bas', icon: FileText },
      {
        name: 'Bank Feeds',
        href: '/dashboard/finance/bank-feeds',
        icon: Landmark,
        comingSoon: true,
      },
      { name: 'Emails', href: '/dashboard/finance/emails', icon: Mail },
    ],
  },
  {
    id: 'admin',
    label: 'Workspace',
    items: [
      { name: 'Workflows', href: '/dashboard/workflows', icon: GitMerge, comingSoon: true },
      { name: 'Approvals', href: '/dashboard/approvals', icon: CheckCircle, comingSoon: true },
      { name: 'Alerts', href: '/dashboard/alerts', icon: Bell, comingSoon: true },
      {
        name: 'AI Assistant',
        href: '/dashboard/ai-reports/ai-assistant',
        icon: Bot,
        comingSoon: true,
      },
      { name: 'Team', href: '/dashboard/settings/team', icon: Users },
      {
        name: 'Billing',
        href: '/dashboard/settings/billing',
        icon: CreditCard,
        comingSoon: true,
      },
      { name: 'Integrations', href: '/dashboard/settings/integrations', icon: Settings },
      { name: 'Shadow programme', href: '/dashboard/settings/shadow', icon: Eye },
    ],
  },
];

const DEFAULT_OPEN = ['operations', 'crm', 'inventory'];

/** Highlight the nav item whose href is the longest prefix of pathname (avoids parent+child both active). */
function getActiveNavHref(pathname: string, items: NavItem[]): string | null {
  let best: { href: string; len: number } | null = null;
  for (const item of items) {
    if (item.comingSoon) continue;
    const { href } = item;
    if (pathname === href || pathname.startsWith(`${href}/`)) {
      if (!best || href.length > best.len) best = { href, len: href.length };
    }
  }
  return best?.href ?? null;
}

function NavLink({ item, isActive }: { item: NavItem; isActive: boolean }) {
  if (item.comingSoon) {
    return (
      <div
        className="flex cursor-not-allowed items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-zinc-500"
        aria-disabled="true"
        title="Coming soon"
      >
        <item.icon className="h-4 w-4 shrink-0 opacity-70" aria-hidden />
        <span className="min-w-0 flex-1 truncate">{item.name}</span>
        <span className="shrink-0 rounded-md border border-white/10 bg-zinc-900/80 px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-zinc-400 uppercase">
          Soon
        </span>
      </div>
    );
  }

  return (
    <Link
      href={item.href}
      className={cn(
        'group relative flex items-center gap-3 overflow-hidden rounded-lg px-3 py-2 text-sm font-medium transition-all',
        isActive
          ? 'bg-primary text-white shadow-md ring-1 ring-white/15'
          : 'text-zinc-300 hover:scale-[1.01] hover:bg-white/[0.07] hover:text-white'
      )}
    >
      {isActive && (
        <motion.div
          layoutId="sidebar-indicator"
          className="absolute top-0 bottom-0 left-0 w-1 rounded-r-full bg-white"
          transition={{ type: 'spring', stiffness: 500, damping: 30 }}
        />
      )}
      <motion.div
        whileHover={{ scale: 1.2, rotate: isActive ? 0 : 15 }}
        transition={{ type: 'spring', stiffness: 400, damping: 10 }}
      >
        <item.icon className={cn('h-4 w-4', isActive ? 'text-white' : 'text-current')} />
      </motion.div>
      <span className="relative z-10">{item.name}</span>
      {!isActive && (
        <motion.div
          className="bg-primary/5 absolute inset-0 rounded-lg"
          initial={{ scale: 0, opacity: 0 }}
          whileHover={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.2 }}
        />
      )}
    </Link>
  );
}

export function Sidebar() {
  const pathname = usePathname();
  const [openGroups, setOpenGroups] = useState<Set<string>>(() => new Set(DEFAULT_OPEN));
  const [userRole, setUserRole] = useState<'owner' | 'admin' | 'member' | 'billing' | null>(null);
  const [roleResolved, setRoleResolved] = useState(false);

  // Persist collapsed state in localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem('sidebar-groups');
      if (saved) {
        setOpenGroups(new Set(JSON.parse(saved) as string[]));
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const user = await authApi.getCurrentUser();
        if (!mounted) return;
        // Treat users flagged as is_admin as admin access even if role is stale.
        const effectiveRole =
          user?.is_admin && user.role !== 'owner' ? 'admin' : (user?.role ?? null);
        setUserRole(effectiveRole);
      } finally {
        if (mounted) setRoleResolved(true);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const filteredNavGroups = useMemo(
    () =>
      navGroups.filter((group) => {
        // Prevent a privileged-link flash before role is loaded.
        if (!roleResolved) {
          return group.id !== 'admin' && group.id !== 'finance';
        }
        if (!userRole || userRole === 'owner' || userRole === 'admin') return true;
        if (userRole === 'billing') {
          return group.id === 'finance' || group.id === 'admin';
        }
        if (userRole === 'member') {
          return group.id !== 'admin' && group.id !== 'finance';
        }
        return true;
      }),
    [userRole, roleResolved]
  );

  const flatNavItems = useMemo(
    () => filteredNavGroups.flatMap((g) => g.items),
    [filteredNavGroups]
  );

  const activeNavHref = useMemo(
    () => getActiveNavHref(pathname, flatNavItems),
    [pathname, flatNavItems]
  );

  // Auto-expand the group containing the active route
  useEffect(() => {
    for (const group of filteredNavGroups) {
      if (group.items.some((item) => !item.comingSoon && pathname.startsWith(item.href))) {
        setOpenGroups((prev) => {
          if (prev.has(group.id)) return prev;
          const next = new Set(prev);
          next.add(group.id);
          return next;
        });
      }
    }
  }, [pathname, userRole, filteredNavGroups]);

  const toggleGroup = (id: string) => {
    setOpenGroups((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      try {
        localStorage.setItem('sidebar-groups', JSON.stringify([...next]));
      } catch {
        // ignore
      }
      return next;
    });
  };

  const [logoutLoading, setLogoutLoading] = useState(false);

  async function handleLogout() {
    setLogoutLoading(true);
    try {
      await logoutAndRedirectToLogin();
    } catch {
      setLogoutLoading(false);
    }
  }

  return (
    <aside className="flex h-full min-h-0 w-full flex-col bg-zinc-950/90 backdrop-blur-xl">
      <div className="flex h-14 shrink-0 items-center justify-between border-b border-white/10 px-4">
        <Link href="/" className="group flex items-center gap-2 font-semibold">
          <motion.span
            className="text-xl"
            whileHover={{ scale: 1.1, rotate: 5 }}
            whileTap={{ scale: 0.95 }}
            transition={{ type: 'spring', stiffness: 400, damping: 10 }}
          >
            ⚙️
          </motion.span>
          <span className="font-semibold text-zinc-100 transition-colors group-hover:text-white">
            CCW Online
          </span>
        </Link>
        <NotificationBell />
      </div>

      <nav className="min-h-0 flex-1 space-y-1 overflow-x-hidden overflow-y-auto overscroll-y-contain p-3 [scrollbar-gutter:stable]">
        {/* Dashboard — always visible, no group */}
        <NavLink
          item={{ name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard }}
          isActive={pathname === '/dashboard' || pathname === '/dashboard/'}
        />

        {/* Grouped navigation */}
        {filteredNavGroups.map((group) => {
          const isOpen = openGroups.has(group.id);
          const hasActiveItem = group.items.some((item) => activeNavHref === item.href);
          return (
            <div key={group.id}>
              <button
                onClick={() => toggleGroup(group.id)}
                className={cn(
                  'mt-2 flex w-full items-center justify-between rounded-md px-3 py-1.5 text-xs font-semibold tracking-wider uppercase transition-colors',
                  hasActiveItem ? 'text-indigo-300' : 'text-zinc-400 hover:text-zinc-200'
                )}
              >
                <span>{group.label}</span>
                {isOpen ? (
                  <ChevronDown className="h-3 w-3" />
                ) : (
                  <ChevronRight className="h-3 w-3" />
                )}
              </button>

              {isOpen && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.2 }}
                  className="mt-0.5 space-y-0.5"
                >
                  {group.items.map((item) => (
                    <NavLink
                      key={`${group.id}-${item.href}`}
                      item={item}
                      isActive={!item.comingSoon && activeNavHref === item.href}
                    />
                  ))}
                </motion.div>
              )}
            </div>
          );
        })}
      </nav>

      <div className="shrink-0 border-t border-white/10 p-3">
        <button
          type="button"
          onClick={handleLogout}
          disabled={logoutLoading}
          className="flex w-full items-center justify-center rounded-lg px-3 py-2.5 text-sm font-medium text-zinc-300 transition-colors hover:bg-white/[0.07] hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
        >
          <span className="inline-flex items-center justify-center gap-2">
            <LogOut className="h-4 w-4 shrink-0 opacity-90" aria-hidden />
            <span>{logoutLoading ? 'Signing out…' : 'Log out'}</span>
          </span>
        </button>
      </div>
    </aside>
  );
}
