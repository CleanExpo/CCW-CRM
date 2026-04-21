import { MarketingAmbientCanvas } from '@/components/landing/marketing-ambient';
import { marketingFont } from '@/components/landing/marketing-font';
import { cn } from '@/lib/utils';

/**
 * Same dark typography/colors as the marketing site, without header or footer.
 * Used for /login, /register, /forgot-password, /reset-password.
 */
export function AuthSiteShell({ children }: { children: React.ReactNode }) {
  return (
    <div
      className={cn(
        marketingFont.className,
        'dark text-foreground selection:bg-primary/30 relative min-h-screen scroll-smooth bg-[#030306] antialiased selection:text-white'
      )}
    >
      <MarketingAmbientCanvas intensity="soft" />
      <main className="relative z-10 min-h-screen">{children}</main>
    </div>
  );
}
