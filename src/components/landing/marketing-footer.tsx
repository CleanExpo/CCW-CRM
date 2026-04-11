import { Layers3 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { marketingShell, marketingSectionRule } from '@/components/landing/marketing-shell';

export function MarketingFooter() {
  return (
    <footer className={cn(marketingSectionRule, 'border-white/[0.08] bg-zinc-950/80')}>
      <div
        className={cn(
          marketingShell,
          'flex flex-col items-center justify-between gap-4 py-12 text-sm text-zinc-500 sm:flex-row'
        )}
      >
        <div className="flex items-center gap-2.5">
          <Layers3 className="h-5 w-5 text-sky-400" />
          <span className="font-semibold text-zinc-200">CCW Online ERP</span>
        </div>
        <p className="text-center sm:text-right">
          &copy; {new Date().getFullYear()} CCW Equipment Suppliers. Brisbane · Sydney · Melbourne
        </p>
      </div>
    </footer>
  );
}
