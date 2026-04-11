import { marketingFont } from '@/components/landing/marketing-font';
import { MarketingFooter } from '@/components/landing/marketing-footer';
import { MarketingHeader } from '@/components/landing/marketing-header';
import { cn } from '@/lib/utils';

export function MarketingSiteChrome({ children }: { children: React.ReactNode }) {
  return (
    <div
      className={cn(
        marketingFont.className,
        'dark text-foreground selection:bg-primary/30 min-h-screen scroll-smooth bg-black antialiased selection:text-white'
      )}
    >
      <MarketingHeader />
      <main>{children}</main>
      <MarketingFooter />
    </div>
  );
}
