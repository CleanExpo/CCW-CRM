'use client';

import dynamic from 'next/dynamic';
import { CreditCard, Eye, Plug, Users } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';

const PANELS = ['team', 'billing', 'integrations', 'shadow'] as const;
export type SettingsPanel = (typeof PANELS)[number];

function isPanel(s: string | null): s is SettingsPanel {
  return s !== null && (PANELS as readonly string[]).includes(s);
}

function PanelFallback() {
  return (
    <div className="text-muted-foreground flex min-h-[32vh] items-center justify-center text-sm">
      Loading…
    </div>
  );
}

const TeamPage = dynamic(() => import('./team/page'), { loading: () => <PanelFallback /> });
const BillingPage = dynamic(() => import('./billing/page'), { loading: () => <PanelFallback /> });
const IntegrationsPage = dynamic(() => import('./integrations/page'), {
  loading: () => <PanelFallback />,
});
const ShadowPage = dynamic(() => import('./shadow/page'), { loading: () => <PanelFallback /> });

export function SettingsHubClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const raw = searchParams.get('panel');
  const panel: SettingsPanel = isPanel(raw) ? raw : 'integrations';

  const setPanel = (next: string) => {
    const p = new URLSearchParams(searchParams.toString());
    if (next === 'integrations') {
      p.delete('panel');
    } else if (isPanel(next)) {
      p.set('panel', next);
    }
    const qs = p.toString();
    router.replace(qs ? `/settings?${qs}` : '/settings', { scroll: false });
  };

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Settings</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Team access, billing, integrations, and shadow programme in one place.
        </p>
      </div>

      <Tabs value={panel} onValueChange={setPanel} className="flex flex-col gap-6">
        <TabsList
          className={cn(
            'bg-muted/60 inline-flex h-auto w-full flex-wrap justify-start gap-1 p-1',
            'md:w-fit md:flex-nowrap'
          )}
        >
          <TabsTrigger value="team" className="gap-2">
            <Users className="h-4 w-4 shrink-0" />
            Team
          </TabsTrigger>
          <TabsTrigger value="billing" className="gap-2">
            <CreditCard className="h-4 w-4 shrink-0" />
            Billing
          </TabsTrigger>
          <TabsTrigger value="integrations" className="gap-2">
            <Plug className="h-4 w-4 shrink-0" />
            Integrations
          </TabsTrigger>
          <TabsTrigger value="shadow" className="gap-2">
            <Eye className="h-4 w-4 shrink-0" />
            Shadow programme
          </TabsTrigger>
        </TabsList>

        <TabsContent value="team" className="mt-0 outline-none focus-visible:ring-0">
          <TeamPage />
        </TabsContent>
        <TabsContent value="billing" className="mt-0 outline-none focus-visible:ring-0">
          <BillingPage />
        </TabsContent>
        <TabsContent value="integrations" className="mt-0 outline-none focus-visible:ring-0">
          <IntegrationsPage />
        </TabsContent>
        <TabsContent value="shadow" className="mt-0 outline-none focus-visible:ring-0">
          <ShadowPage />
        </TabsContent>
      </Tabs>
    </div>
  );
}
