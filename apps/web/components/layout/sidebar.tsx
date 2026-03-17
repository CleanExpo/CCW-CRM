'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
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
} from 'lucide-react';

const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
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
  { name: 'Customers', href: '/customers', icon: Users },
  { name: 'Client Health', href: '/customers/health', icon: HeartPulse },
  { name: 'Onboarding', href: '/customers/onboarding', icon: GitBranch },
  { name: 'Personas', href: '/customers/personas', icon: Tag },
  { name: 'Contacts', href: '/contacts', icon: UserCircle },
  { name: 'Contractors', href: '/contractors', icon: HardHat },
  { name: 'Service Requests', href: '/service-requests', icon: Wrench },
  { name: 'Workshop', href: '/workshop', icon: Wrench },
  { name: 'Equipment', href: '/workshop/equipment', icon: Settings2 },
  { name: 'Schedule', href: '/workshop/schedule', icon: CalendarDays },
  { name: 'Templates', href: '/workshop/templates', icon: ClipboardList },
  { name: 'Reminders', href: '/workshop/reminders', icon: BellRing },
  { name: 'Activities', href: '/activities', icon: Calendar },
  { name: 'Orders', href: '/orders', icon: ShoppingCart },
  { name: 'Fulfilment', href: '/orders/fulfilment', icon: PackageCheck },
  { name: 'POS Terminal', href: '/pos', icon: CreditCard },
  { name: 'Reconciliation', href: '/pos/reconciliation', icon: Scale },
  { name: 'Bank Feeds', href: '/bank-feeds', icon: Landmark },
  { name: 'Quotes', href: '/quotes', icon: FileText },
  { name: 'Invoices', href: '/invoices', icon: Receipt },
  { name: 'Purchase Orders', href: '/purchase-orders', icon: ClipboardList },
  { name: 'Goods Receiving', href: '/purchase-orders/receiving', icon: PackageCheck },
  { name: 'Submissions', href: '/submissions', icon: ClipboardCheck },
  { name: 'Emails', href: '/emails', icon: Mail },
  { name: 'AI Assistant', href: '/ai-assistant', icon: Bot },
  { name: 'PRD Generator', href: '/prd/generate', icon: Sparkles },
  { name: 'Insights', href: '/insights', icon: TrendingUp },
  { name: 'Reports', href: '/reports', icon: BarChart3 },
  { name: 'Marketing', href: '/marketing', icon: Megaphone },
  { name: 'FAQ', href: '/faq', icon: HelpCircle },
  { name: 'Alerts', href: '/alerts', icon: Bell },
  { name: 'Workflows', href: '/workflows', icon: GitMerge },
  { name: 'Approvals', href: '/approvals', icon: CheckCircle },
  { name: 'Monitoring', href: '/monitoring', icon: Activity },
  { name: 'Settings', href: '/settings/integrations', icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="bg-muted/40 w-64 border-r">
      <div className="flex h-14 items-center justify-between border-b px-4">
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
            Equipment ERP
          </span>
        </Link>
        <NotificationBell />
      </div>
      <nav className="flex flex-col gap-1 p-4">
        {navigation.map((item, index) => {
          const isActive = pathname === item.href;
          return (
            <motion.div
              key={item.name}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.05, type: 'spring', stiffness: 300, damping: 25 }}
            >
              <Link
                href={item.href}
                className={cn(
                  'group relative flex items-center gap-3 overflow-hidden rounded-lg px-3 py-2 text-sm transition-all',
                  isActive
                    ? 'bg-primary text-primary-foreground shadow-md'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground hover:scale-105'
                )}
              >
                {/* Active indicator */}
                {isActive && (
                  <motion.div
                    layoutId="sidebar-indicator"
                    className="bg-primary-foreground absolute top-0 bottom-0 left-0 w-1 rounded-r-full"
                    transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                  />
                )}

                {/* Icon with hover effect */}
                <motion.div
                  whileHover={{ scale: 1.2, rotate: isActive ? 0 : 15 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 10 }}
                >
                  <item.icon className="h-4 w-4" />
                </motion.div>

                {/* Text */}
                <span className="relative z-10">{item.name}</span>

                {/* Hover background effect */}
                {!isActive && (
                  <motion.div
                    className="bg-primary/5 absolute inset-0 rounded-lg"
                    initial={{ scale: 0, opacity: 0 }}
                    whileHover={{ scale: 1, opacity: 1 }}
                    transition={{ duration: 0.2 }}
                  />
                )}
              </Link>
            </motion.div>
          );
        })}
      </nav>
    </aside>
  );
}
