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
        'dark text-foreground selection:bg-primary/30 min-h-screen scroll-smooth bg-black antialiased selection:text-white'
      )}
    >
      <main className="min-h-screen">{children}</main>
    </div>
  );
}
