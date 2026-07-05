'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import {
  LayoutGrid,
  Users,
  HeartPulse,
  Building2,
  GitBranch,
  Tag,
  UserCircle,
  HardHat,
  Wrench,
  Calendar,
} from 'lucide-react';

const LINKS: Array<{
  href: string;
  label: string;
  icon: typeof LayoutGrid;
  exact?: boolean;
}> = [
  { href: '/dashboard/crm', label: 'Overview', icon: LayoutGrid, exact: true },
  { href: '/dashboard/crm/customers', label: 'Customers', icon: Users },
  { href: '/dashboard/crm/internal-customers', label: 'Internal customers', icon: Building2 },
  { href: '/dashboard/crm/client-health', label: 'Client Health', icon: HeartPulse },
  { href: '/dashboard/crm/onboarding', label: 'Onboarding', icon: GitBranch },
  { href: '/dashboard/crm/personas', label: 'Personas', icon: Tag },
  { href: '/dashboard/crm/contacts', label: 'Contacts', icon: UserCircle },
  { href: '/dashboard/crm/contractors', label: 'Contractors', icon: HardHat },
  { href: '/dashboard/crm/service-requests', label: 'Service Requests', icon: Wrench },
  { href: '/dashboard/crm/activities', label: 'Activities', icon: Calendar },
];

export function CrmModuleNav() {
  const pathname = usePathname();

  return (
    <nav
      className="mb-6 flex flex-wrap gap-1 rounded-xl border border-white/10 bg-black/20 p-1 backdrop-blur-sm"
      aria-label="CRM modules"
    >
      {LINKS.map(({ href, label, icon: Icon, exact }) => {
        const active = exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
              active
                ? 'bg-primary/20 text-primary shadow-sm'
                : 'text-muted-foreground hover:bg-white/5 hover:text-foreground'
            )}
          >
            <Icon className="h-3.5 w-3.5 shrink-0 opacity-80" aria-hidden />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
