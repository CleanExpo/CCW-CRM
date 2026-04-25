'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { NotificationBell } from '@/components/layout/NotificationBell';
import { logoutAndRedirectToLogin } from '@/lib/api/auth';
import {
  LayoutDashboard,
  Package,
  Users,
  UserCircle,
  ShoppingCart,
  FileText,
  ClipboardList,
  ClipboardCheck,
  Bot,
  TrendingUp,
  Mail,
  Settings,
  Warehouse,
  Ship,
  Truck,
  AlertCircle,
  Bell,
  CheckCircle,
  Sparkles,
  Activity,
  CreditCard,
  Scale,
  Receipt,
  GitMerge,
  PackageSearch,
  PackageCheck,
  Timer,
  BarChart3,
  Calendar,
  Megaphone,
  HelpCircle,
  HardHat,
  Wrench,
  Landmark,
  Settings2,
  CalendarDays,
  BellRing,
  HeartPulse,
  GitBranch,
  Tag,
  Layers,
  Camera,
  Eye,
  UserCog,
  ChevronDown,
  ChevronRight,
  Cpu,
  MessageCircle,
  Store,
  LogOut,
} from 'lucide-react';
import { useEffect, useState } from 'react';

interface NavItem {
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
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
      { name: 'Orders', href: '/dashboard/operations/orders', icon: ShoppingCart },
      { name: 'Fulfilment', href: '/dashboard/operations/fulfilment', icon: PackageCheck },
      { name: 'Quotes', href: '/dashboard/operations/quotes', icon: FileText },
      { name: 'Purchase Orders', href: '/dashboard/operations/purchase-orders', icon: ClipboardList },
      {
        name: 'Goods Receiving',
        href: '/dashboard/operations/purchase-orders/receiving',
        icon: PackageCheck,
      },
      { name: 'POS Terminal', href: '/dashboard/operations/pos', icon: CreditCard },
      { name: 'Reconciliation', href: '/dashboard/operations/pos/reconciliation', icon: Scale },
      { name: 'Submissions', href: '/dashboard/operations/submissions', icon: ClipboardCheck },
    ],
  },
  {
    id: 'crm',
    label: 'CRM',
    items: [
      { name: 'Customers', href: '/customers', icon: Users },
      { name: 'Client Health', href: '/customers/health', icon: HeartPulse },
      { name: 'Onboarding', href: '/customers/onboarding', icon: GitBranch },
      { name: 'Personas', href: '/customers/personas', icon: Tag },
      { name: 'Contacts', href: '/contacts', icon: UserCircle },
      { name: 'Contractors', href: '/contractors', icon: HardHat },
      { name: 'Service Requests', href: '/service-requests', icon: Wrench },
      { name: 'Activities', href: '/activities', icon: Calendar },
    ],
  },
  {
    id: 'workshop',
    label: 'Workshop',
    items: [
      { name: 'Workshop', href: '/workshop', icon: Wrench },
      { name: 'Equipment', href: '/workshop/equipment', icon: Settings2 },
      { name: 'Schedule', href: '/workshop/schedule', icon: CalendarDays },
      { name: 'Templates', href: '/workshop/templates', icon: ClipboardList },
      { name: 'Reminders', href: '/workshop/reminders', icon: BellRing },
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
      { name: 'Invoices', href: '/invoices', icon: Receipt },
      { name: 'BAS Report', href: '/invoices/bas', icon: FileText },
      { name: 'Bank Feeds', href: '/bank-feeds', icon: Landmark },
      { name: 'Emails', href: '/emails', icon: Mail },
    ],
  },
  {
    id: 'ai',
    label: 'AI & Reports',
    items: [
      { name: 'AI Assistant', href: '/ai-assistant', icon: Bot },
      { name: 'AI Ops Centre', href: '/ai-ops', icon: Cpu },
      { name: 'AI Query', href: '/ai-query', icon: MessageCircle },
      { name: 'PRD Generator', href: '/prd/generate', icon: Sparkles },
      { name: 'Insights', href: '/insights', icon: TrendingUp },
      { name: 'Reports', href: '/reports', icon: BarChart3 },
      { name: 'Marketing', href: '/marketing', icon: Megaphone },
      { name: 'Marketplace', href: '/marketplace', icon: Store },
    ],
  },
  {
    id: 'admin',
    label: 'Admin',
    items: [
      { name: 'Workflows', href: '/workflows', icon: GitMerge },
      { name: 'Approvals', href: '/approvals', icon: CheckCircle },
      { name: 'Alerts', href: '/alerts', icon: Bell },
      { name: 'Monitoring', href: '/monitoring', icon: Activity },
      { name: 'FAQ', href: '/faq', icon: HelpCircle },
      { name: 'Team', href: '/settings/team', icon: Users },
      { name: 'Billing', href: '/settings/billing', icon: CreditCard },
      { name: 'Mobile Orders', href: '/settings/mobile', icon: Camera },
      { name: 'Shadow Mode', href: '/settings/shadow', icon: Eye },
      { name: 'Client Onboarding', href: '/settings/onboarding', icon: UserCog },
      { name: 'Settings', href: '/settings/integrations', icon: Settings },
    ],
  },
];

const DEFAULT_OPEN = ['operations', 'crm', 'inventory'];

function NavLink({ item, isActive }: { item: NavItem; isActive: boolean }) {
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

  // Auto-expand the group containing the active route
  useEffect(() => {
    for (const group of navGroups) {
      if (group.items.some((item) => pathname.startsWith(item.href))) {
        setOpenGroups((prev) => {
          if (prev.has(group.id)) return prev;
          const next = new Set(prev);
          next.add(group.id);
          return next;
        });
      }
    }
  }, [pathname]);

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

      <nav className="min-h-0 flex-1 space-y-1 overflow-y-auto overflow-x-hidden overscroll-y-contain p-3 [scrollbar-gutter:stable]">
        {/* Dashboard — always visible, no group */}
        <NavLink
          item={{ name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard }}
          isActive={pathname === '/dashboard'}
        />

        {/* Grouped navigation */}
        {navGroups.map((group) => {
          const isOpen = openGroups.has(group.id);
          const hasActiveItem = group.items.some((item) => pathname.startsWith(item.href));
          return (
            <div key={group.id}>
              <button
                onClick={() => toggleGroup(group.id)}
                className={cn(
                  'mt-2 flex w-full items-center justify-between rounded-md px-3 py-1.5 text-xs font-semibold tracking-wider uppercase transition-colors',
                  hasActiveItem
                    ? 'text-indigo-300'
                    : 'text-zinc-400 hover:text-zinc-200'
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
                    <NavLink key={item.name} item={item} isActive={pathname === item.href} />
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
