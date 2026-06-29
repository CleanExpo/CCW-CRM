'use client';

import { marketingShell } from '@/components/landing/marketing-shell';
import { CcwLogo } from '@/components/brand/ccw-logo';
import { Card, CardContent, CardDescription, CardHeader } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { ShieldCheck } from 'lucide-react';

export function AuthPageShell({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        marketingShell,
        'relative flex min-h-[calc(100vh-12rem)] flex-col items-center justify-center py-16 md:py-24'
      )}
    >
      <div className="pointer-events-none absolute -top-12 h-40 w-40 rounded-full bg-sky-500/20 blur-3xl" />
      <div className="pointer-events-none absolute -right-8 bottom-2 h-44 w-44 rounded-full bg-indigo-500/20 blur-3xl" />
      <Card className="relative w-full max-w-md overflow-hidden border border-white/[0.1] bg-zinc-950/88 text-zinc-50 shadow-2xl shadow-black/50 ring-1 ring-white/10 backdrop-blur-xl">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-sky-500 via-indigo-500 to-violet-500" />
        <CardHeader className="space-y-2 pb-2">
          <div className="mb-3 flex justify-center">
            <CcwLogo variant="compact" size="md" showTagline={false} href="/" />
          </div>
          <div className="mx-auto mb-2 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[11px] font-semibold tracking-[0.14em] text-zinc-300 uppercase">
            <ShieldCheck className="h-3.5 w-3.5 text-sky-300" />
            Secure Access
          </div>
          <h1 className="text-center text-2xl font-bold tracking-tight text-white">{title}</h1>
          {description ? (
            <CardDescription className="text-center text-sm text-zinc-400">{description}</CardDescription>
          ) : null}
        </CardHeader>
        <CardContent className="pt-3">{children}</CardContent>
      </Card>
    </div>
  );
}
