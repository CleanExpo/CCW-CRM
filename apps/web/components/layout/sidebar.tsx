'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { NotificationBell } from '@/components/layout/NotificationBell';
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
import { useState, useEffect } from 'react';

export interface NavItem {
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
}

export interface NavGroup {
  id: string;
  label: string;
  items: NavItem[];
}

export const navGroups: NavGroup[] = [
  {
    id: 'operations',
    label: 'Operations',
    items: [
      { name: 'Orders', href: '/orders', icon: ShoppingCart },
      { name: 'Fulfilment', href: '/orders/fulfilment', icon: PackageCheck },
      { name: 'Quotes', href: '/quotes', icon: FileText },
      { name: 'Purchase Orders', href: '/purchase-orders', icon: ClipboardList },
      { name: 'Goods Receiving', href: '/purchase-orders/receiving', icon: PackageCheck },
      { name: 'POS Terminal', href: '/pos', icon: CreditCard },
      { name: 'Reconciliation', href: '/pos/reconciliation', icon: Scale },
      { name: 'Submissions', href: '/submissions', icon: ClipboardCheck },
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
      { name: 'Products', href: '/products', icon: Package },
      { name: 'Inventory Overview', href: '/inventory', icon: Warehouse },
      { name: 'Bill of Materials', href: '/inventory/bom', icon: Layers },
      { name: 'Stock List', href: '/inventory/stock', icon: PackageSearch },
      { name: 'Stock Transfers', href: '/inventory/transfers', icon: PackageCheck },
      { name: 'Reservations', href: '/inventory/reservations', icon: Timer },
      { name: 'Stock Forecast', href: '/inventory/forecast', icon: BarChart3 },
      { name: 'Warehouse Ops', href: '/warehouse', icon: Truck },
      { name: 'Containers', href: '/containers', icon: Ship },
      { name: 'Backorders', href: '/backorders', icon: AlertCircle },
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
        'group relative flex items-center gap-3 overflow-hidden rounded-lg px-3 py-2 text-sm transition-all',
        isActive
          ? 'bg-primary text-primary-foreground shadow-md'
          : 'text-muted-foreground hover:bg-muted hover:text-foreground hover:scale-105'
      )}
    >
      {isActive && (
        <motion.div
          layoutId="sidebar-indicator"
          className="bg-primary-foreground absolute top-0 bottom-0 left-0 w-1 rounded-r-full"
          transition={{ type: 'spring', stiffness: 500, damping: 30 }}
        />
      )}
      <motion.div
        whileHover={{ scale: 1.2, rotate: isActive ? 0 : 15 }}
        transition={{ type: 'spring', stiffness: 400, damping: 10 }}
      >
        <item.icon className="h-4 w-4" />
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

async function logout(router: ReturnType<typeof useRouter>) {
  try {
    await fetch('/api/auth/logout', { method: 'POST' });
  } catch {
    // ignore — clear client state regardless
  }
  localStorage.removeItem('onboarding_completed');
  router.push('/login');
}

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
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

  return (
    <aside className="bg-muted/40 flex w-64 flex-col border-r">
      <div className="flex h-14 shrink-0 items-center justify-between border-b px-4">
        <Link href="/" className="group flex items-center gap-2 font-semibold">
          <motion.span
            className="text-xl"
            whileHover={{ scale: 1.1, rotate: 5 }}
            whileTap={{ scale: 0.95 }}
            transition={{ type: 'spring', stiffness: 400, damping: 10 }}
          >
            ⚙️
          </motion.span>
          <span className="from-primary to-primary/60 group-hover:from-primary/80 group-hover:to-primary/40 bg-gradient-to-r bg-clip-text text-transparent transition-all">
            CCW Online
          </span>
        </Link>
        <NotificationBell />
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto p-3" id="sidebar-nav">
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
                  hasActiveItem ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
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

      {/* Logout */}
      <div className="border-t p-3">
        <motion.button
          onClick={() => void logout(router)}
          className="hover:bg-destructive/10 text-muted-foreground hover:text-destructive group flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm transition-all"
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          <motion.div
            whileHover={{ scale: 1.2, rotate: -15 }}
            transition={{ type: 'spring', stiffness: 400, damping: 10 }}
          >
            <LogOut className="h-4 w-4" />
          </motion.div>
          <span>Log out</span>
        </motion.button>
      </div>
    </aside>
  );
}
