'use client';

import { cn } from '@/lib/utils';

const NOISE_DATA_URI =
  "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.5'/%3E%3C/svg%3E\")";

type MarketingAmbientCanvasProps = {
  /** Softer layers for dense UIs (e.g. auth cards) */
  intensity?: 'default' | 'soft';
  className?: string;
};

/**
 * Full-viewport mesh: deep base, aurora drift, soft orbs, grid, and film grain.
 * Sits behind marketing + auth public shells (fixed, non-interactive).
 */
export function MarketingAmbientCanvas({
  intensity = 'default',
  className,
}: MarketingAmbientCanvasProps) {
  const soft = intensity === 'soft';

  return (
    <div
      className={cn('pointer-events-none fixed inset-0 z-0 overflow-hidden', className)}
      aria-hidden
    >
      <div className="absolute inset-0 bg-[#030306]" />

      {/* Primary glow — top center */}
      <div
        className={cn(
          'absolute left-1/2 -translate-x-1/2 bg-[radial-gradient(ellipse_95%_65%_at_50%_-8%,rgba(56,189,248,0.2),transparent_58%)]',
          soft ? 'top-0 h-[55%] w-[130%] opacity-70' : 'top-0 h-[65%] w-[150%] opacity-100'
        )}
      />

      {/* Secondary — indigo / violet pockets */}
      <div
        className={cn(
          'absolute rounded-full bg-[radial-gradient(circle,hsl(var(--accent)/0.14),transparent_62%)] blur-3xl',
          'animate-landing-drift opacity-50',
          soft ? '-right-[25%] top-[18%] h-[45%] w-[45%]' : '-right-[18%] top-[12%] h-[58%] w-[58%]'
        )}
        style={{ animationDuration: '36s' }}
      />
      <div
        className={cn(
          'absolute rounded-full bg-[radial-gradient(circle,hsl(var(--primary)/0.12),transparent_58%)] blur-3xl',
          soft ? '-bottom-[8%] -left-[12%] h-[38%] w-[38%] opacity-60' : '-bottom-[12%] -left-[8%] h-[48%] w-[48%] opacity-80'
        )}
      />

      {/* Conic wash — very slow */}
      <div
        className={cn(
          'absolute -inset-[35%] rounded-full bg-[conic-gradient(from_200deg_at_50%_50%,hsl(var(--primary)/0.12)_0deg,transparent_100deg,hsl(var(--accent)/0.08)_200deg,transparent_300deg)] opacity-40 blur-3xl',
          'animate-landing-aurora'
        )}
      />

      {/* Structural grid */}
      <div
        className={cn(
          'absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.028)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.028)_1px,transparent_1px)] bg-[length:64px_64px]',
          '[mask-image:radial-gradient(ellipse_85%_65%_at_50%_18%,black,transparent)]',
          soft ? 'opacity-35' : 'opacity-45'
        )}
      />

      {/* Bottom vignette for depth */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_120%_80%_at_50%_120%,rgba(0,0,0,0.55),transparent_52%)]" />

      {/* Film grain */}
      <div
        className="absolute inset-0 opacity-[0.22] mix-blend-overlay"
        style={{ backgroundImage: NOISE_DATA_URI }}
      />
    </div>
  );
}
