'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { apiClient } from '@/lib/api/client';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Users,
  UserCircle,
  Calendar,
  ArrowRight,
  Link2,
  HeartPulse,
  GitBranch,
  Tag,
  HardHat,
  Wrench,
} from 'lucide-react';

interface Overview {
  customers: number;
  contacts: number;
  activities_last_30_days: number;
  pending_tasks: number;
}

const MODULES: Array<{
  title: string;
  description: string;
  href: string;
  icon: typeof Users;
}> = [
  {
    title: 'Customers',
    description: 'Accounts, revenue context, and linked people.',
    href: '/dashboard/crm/customers',
    icon: Users,
  },
  {
    title: 'Contacts',
    description: 'Stakeholders tied to customers; feed activities and comms.',
    href: '/dashboard/crm/contacts',
    icon: UserCircle,
  },
  {
    title: 'Activities',
    description: 'Calls, meetings, notes, and tasks with customer & contact links.',
    href: '/dashboard/crm/activities',
    icon: Calendar,
  },
  {
    title: 'Client Health',
    description: 'Risk and engagement signals across the book.',
    href: '/dashboard/crm/client-health',
    icon: HeartPulse,
  },
  {
    title: 'Onboarding',
    description: 'Implementation stages with primary contacts in view.',
    href: '/dashboard/crm/onboarding',
    icon: GitBranch,
  },
  {
    title: 'Personas',
    description: 'Segmentation that informs how you talk to each contact.',
    href: '/dashboard/crm/personas',
    icon: Tag,
  },
  {
    title: 'Contractors',
    description: 'Field partners linked to service work.',
    href: '/dashboard/crm/contractors',
    icon: HardHat,
  },
  {
    title: 'Service Requests',
    description: 'Jobs tied back to customers (contact links on the roadmap).',
    href: '/dashboard/crm/service-requests',
    icon: Wrench,
  },
];

export default function CrmHubPage() {
  const [stats, setStats] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const data = await apiClient.get<Overview>('/api/crm/overview');
        if (!cancelled) setStats(data);
      } catch {
        if (!cancelled) setStats(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">CRM workspace</h1>
        <p className="text-muted-foreground mt-1 max-w-2xl text-sm leading-relaxed">
          Customers, contacts, and activities share one graph: link people to accounts, log work on
          timelines, and jump between modules without losing context.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {loading ? (
          <>
            <Skeleton className="h-28 rounded-xl" />
            <Skeleton className="h-28 rounded-xl" />
            <Skeleton className="h-28 rounded-xl" />
            <Skeleton className="h-28 rounded-xl" />
          </>
        ) : (
          <>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Active customers</CardDescription>
                <CardTitle className="text-3xl tabular-nums">{stats?.customers ?? 0}</CardTitle>
              </CardHeader>
              {!stats && (
                <CardContent className="pt-0">
                  <p className="text-muted-foreground text-xs">Overview stats unavailable — modules below still work.</p>
                </CardContent>
              )}
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Contacts</CardDescription>
                <CardTitle className="text-3xl tabular-nums">{stats?.contacts ?? 0}</CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Activities (30 days)</CardDescription>
                <CardTitle className="text-3xl tabular-nums">{stats?.activities_last_30_days ?? 0}</CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Open tasks</CardDescription>
                <CardTitle className="text-3xl tabular-nums">{stats?.pending_tasks ?? 0}</CardTitle>
              </CardHeader>
            </Card>
          </>
        )}
      </div>

      <Card className="border-dashed">
        <CardHeader className="flex flex-row items-start gap-3 space-y-0">
          <Link2 className="text-muted-foreground mt-0.5 h-5 w-5 shrink-0" aria-hidden />
          <div>
            <CardTitle className="text-base">How data connects</CardTitle>
            <CardDescription className="mt-1">
              Contacts live under customers. Activities store both{' '}
              <span className="text-foreground/90">customer_id</span> and{' '}
              <span className="text-foreground/90">contact_id</span> so timelines roll up to the
              account and the person. Personas classify the account; client health and onboarding
              views read the same customer spine.
            </CardDescription>
          </div>
        </CardHeader>
      </Card>

      <div>
        <h2 className="mb-3 text-lg font-semibold">Modules</h2>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {MODULES.map((m) => (
            <Link key={m.href} href={m.href} className="group block">
              <Card className="h-full transition-colors group-hover:border-primary/40">
                <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
                  <m.icon className="text-muted-foreground h-5 w-5" aria-hidden />
                  <ArrowRight className="text-muted-foreground h-4 w-4 opacity-0 transition-opacity group-hover:opacity-100" />
                </CardHeader>
                <CardContent className="pt-0">
                  <p className="font-medium">{m.title}</p>
                  <p className="text-muted-foreground mt-1 text-sm">{m.description}</p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
