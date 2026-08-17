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
      <div className="absolute inset-0 bg-[#050508]" />

      {/* Primary glow — restrained sky wash */}
      <div
        className={cn(
          'absolute left-1/2 -translate-x-1/2 bg-[radial-gradient(ellipse_90%_55%_at_50%_-8%,rgba(14,165,233,0.14),transparent_60%)]',
          soft ? 'top-0 h-[50%] w-[120%] opacity-60' : 'top-0 h-[58%] w-[140%] opacity-90'
        )}
      />

      {/* Secondary depth — cool zinc, not violet */}
      <div
        className={cn(
          'absolute rounded-full bg-[radial-gradient(circle,rgba(161,161,170,0.08),transparent_62%)] blur-3xl',
          'animate-landing-drift opacity-40',
          soft ? 'top-[20%] -right-[28%] h-[40%] w-[40%]' : 'top-[14%] -right-[20%] h-[50%] w-[50%]'
        )}
        style={{ animationDuration: '40s' }}
      />
      <div
        className={cn(
          'absolute rounded-full bg-[radial-gradient(circle,rgba(14,165,233,0.08),transparent_58%)] blur-3xl',
          soft
            ? '-bottom-[8%] -left-[12%] h-[34%] w-[34%] opacity-50'
            : '-bottom-[12%] -left-[8%] h-[42%] w-[42%] opacity-70'
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

export default MarketingAmbientCanvas;
