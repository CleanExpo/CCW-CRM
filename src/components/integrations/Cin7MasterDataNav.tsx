'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion } from 'framer-motion';
import { LayoutGrid, Settings2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  CIN7_INTEGRATIONS_URL,
  CIN7_MASTER_DATA_HUB_URL,
  CIN7_VERIFY_PAGES,
} from '@/lib/integrations/cin7-master-data-routes';
import type { Cin7SyncEntity } from '@/components/integrations/Cin7SyncButton';

type Cin7MasterDataNavProps = {
  active?: Cin7SyncEntity | 'hub';
  className?: string;
};

export function Cin7MasterDataNav({ active, className }: Cin7MasterDataNavProps) {
  const pathname = usePathname();

  const resolveActive = (href: string, key: Cin7SyncEntity): boolean => {
    if (active === key) return true;
    if (active === 'hub' && href === CIN7_MASTER_DATA_HUB_URL) return true;
    return pathname === href || pathname.startsWith(`${href}/`);
  };

  const hubActive =
    active === 'hub' || pathname === CIN7_MASTER_DATA_HUB_URL || pathname.startsWith(`${CIN7_MASTER_DATA_HUB_URL}/`);

  return (
    <nav
      className={cn(
        'flex flex-wrap items-center gap-1 overflow-x-auto rounded-xl border border-white/10 bg-black/25 p-1 backdrop-blur-sm',
        className
      )}
      aria-label="Cin7 master data"
    >
      <Link
        href={CIN7_MASTER_DATA_HUB_URL}
        className={cn(
          'relative inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
          hubActive
            ? 'bg-primary/20 text-primary shadow-sm'
            : 'text-muted-foreground hover:bg-white/5 hover:text-foreground'
        )}
      >
        {hubActive ? (
          <motion.span
            layoutId="cin7-nav-indicator"
            className="bg-primary/15 absolute inset-0 rounded-lg"
            transition={{ type: 'spring', stiffness: 420, damping: 32 }}
          />
        ) : null}
        <LayoutGrid className="relative h-3.5 w-3.5 shrink-0 opacity-80" aria-hidden />
        <span className="relative">All Cin7 data</span>
      </Link>

      {CIN7_VERIFY_PAGES.map(({ key, label, href, icon: Icon }) => {
        const isActive = resolveActive(href, key);
        return (
          <Link
            key={key}
            href={href}
            className={cn(
              'relative inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
              isActive
                ? 'bg-primary/20 text-primary shadow-sm'
                : 'text-muted-foreground hover:bg-white/5 hover:text-foreground'
            )}
          >
            {isActive ? (
              <motion.span
                layoutId="cin7-nav-indicator"
                className="bg-primary/15 absolute inset-0 rounded-lg"
                transition={{ type: 'spring', stiffness: 420, damping: 32 }}
              />
            ) : null}
            <Icon className="relative h-3.5 w-3.5 shrink-0 opacity-80" aria-hidden />
            <span className="relative hidden sm:inline">{label}</span>
            <span className="relative sm:hidden">{label.split(' ')[0]}</span>
          </Link>
        );
      })}

      <Link
        href={CIN7_INTEGRATIONS_URL}
        className="text-muted-foreground ml-auto inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors hover:bg-white/5 hover:text-foreground"
      >
        <Settings2 className="h-3.5 w-3.5 shrink-0 opacity-80" aria-hidden />
        <span className="hidden md:inline">Integrations</span>
      </Link>
    </nav>
  );
}
