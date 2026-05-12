'use client';

import Link from 'next/link';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  AlertCircle,
  ArrowRight,
  BarChart3,
  Bell,
  Bot,
  Calendar,
  CalendarDays,
  CheckCircle,
  ClipboardList,
  CreditCard,
  Eye,
  Factory,
  FileText,
  GitMerge,
  HardHat,
  HeartPulse,
  Inbox,
  Landmark,
  Layers,
  LayoutDashboard,
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
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';

export type HubIconKey = keyof typeof ICON_MAP;

/** Serializable keys → icons (safe across Server/Client boundaries when keys are used only). */
export const ICON_MAP = {
  LayoutDashboard,
  FileText,
  ShoppingCart,
  PackageCheck,
  ClipboardList,
  PackagePlus,
  Store,
  Scale,
  Inbox,
  Receipt,
  Landmark,
  Mail,
  GitMerge,
  CheckCircle,
  Bell,
  Bot,
  Users,
  CreditCard,
  Settings,
  Eye,
  Package,
  Layers,
  PackageSearch,
  Timer,
  BarChart3,
  Truck,
  Ship,
  AlertCircle,
  Warehouse,
  CalendarDays,
  Factory,
  HeartPulse,
  Tag,
  UserCircle,
  HardHat,
  Wrench,
  Calendar,
} satisfies Record<string, LucideIcon>;

export type HubModuleItem = {
  title: string;
  description: string;
  href: string;
  icon: HubIconKey;
  comingSoon?: boolean;
};

type SectionHubModulesProps = {
  modules: HubModuleItem[];
  heading?: string;
  className?: string;
};

function HubIcon({ name, className }: { name: HubIconKey; className?: string }) {
  const Icon = ICON_MAP[name];
  if (!Icon) return null;
  return <Icon className={className} aria-hidden />;
}

/**
 * CRM-style module grid — pass `icon` as a key from {@link ICON_MAP} (RSC-safe plain data).
 */
export function SectionHubModules({
  modules,
  heading = 'Modules',
  className,
}: SectionHubModulesProps) {
  return (
    <div className={cn('space-y-3', className)}>
      <h2 className="text-lg font-semibold">{heading}</h2>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {modules.map((m) => {
          if (m.comingSoon) {
            return (
              <div key={`${m.href}-${m.title}`} className="block">
                <Card className="h-full cursor-not-allowed opacity-80">
                  <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
                    <HubIcon name={m.icon} className="text-muted-foreground h-5 w-5 shrink-0" />
                    <Badge variant="secondary" className="text-[10px] uppercase">
                      Soon
                    </Badge>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <p className="font-medium">{m.title}</p>
                    <p className="text-muted-foreground mt-1 text-sm">{m.description}</p>
                  </CardContent>
                </Card>
              </div>
            );
          }
          return (
            <Link key={m.href} href={m.href} className="group block">
              <Card className="h-full transition-colors group-hover:border-primary/40">
                <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
                  <HubIcon name={m.icon} className="text-muted-foreground h-5 w-5 shrink-0" />
                  <ArrowRight className="text-muted-foreground h-4 w-4 opacity-0 transition-opacity group-hover:opacity-100" />
                </CardHeader>
                <CardContent className="pt-0">
                  <p className="font-medium">{m.title}</p>
                  <p className="text-muted-foreground mt-1 text-sm">{m.description}</p>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
