'use client';

import { MarketingAmbientCanvas } from '@/components/landing/marketing-ambient';
import { marketingFont } from '@/components/landing/marketing-font';
import { MarketingFooter } from '@/components/landing/marketing-footer';
import { MarketingHeader } from '@/components/landing/marketing-header';
import { cn } from '@/lib/utils';

export default function MarketingSiteChrome({ children }: { children: React.ReactNode }) {
  return (
    <div
      className={cn(
        marketingFont.className,
        'dark text-foreground relative min-h-screen scroll-smooth bg-[#050508] antialiased selection:bg-sky-500/25 selection:text-white'
      )}
    >
      <MarketingAmbientCanvas />
      <div className="relative z-10">
        <MarketingHeader />
        <main>{children}</main>
        <MarketingFooter />
      </div>
    </div>
  );
}
