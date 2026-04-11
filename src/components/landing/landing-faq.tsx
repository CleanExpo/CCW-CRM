'use client';

import { cn } from '@/lib/utils';
import { ChevronDown } from 'lucide-react';
import { useState } from 'react';

const FAQ_ITEMS: { q: string; a: string }[] = [
  {
    q: 'Who is CCW Online ERP built for?',
    a: 'Wholesalers and distributors who move physical stock—especially teams juggling quotes, orders, warehouse work, and finance hand-offs. If you are tired of spreadsheets and disconnected tools, this platform is designed to centralise your day-to-day operations.',
  },
  {
    q: 'Can we connect inventory and accounting systems we already use?',
    a: 'Yes. The product roadmap emphasises deep links to inventory platforms (such as Cin7), accounting (Xero), and e-commerce (Shopify). Exact connectors depend on your plan and environment—your onboarding team maps what is live for your tenant.',
  },
  {
    q: 'How long until our team is productive?',
    a: 'Documentation targets role-based onboarding so new hires can reach first productive tasks in days, not weeks. Quick-start guides exist for sales, warehouse, finance, and customer service—paired with in-app patterns as they roll out.',
  },
  {
    q: 'Where is our data hosted?',
    a: 'Architecture documentation describes PostgreSQL on Supabase in the Asia-Pacific region (Sydney) for Australian operators. Confirm retention, backups, and compliance with your implementation lead before go-live.',
  },
  {
    q: 'Do we get training and support?',
    a: 'User guides cover core modules (products, customers, orders, quotes). Training audits call out role-specific quick starts and future in-app discovery for AI-assisted workflows. Enterprise-style runbooks support operations and incidents.',
  },
  {
    q: 'Can we start with a subset of modules?',
    a: 'Absolutely. Many teams begin with quote-to-order and catalog hygiene, then layer inventory sync, procurement, and finance reconciliation. The modular surface area is designed to grow with your operation.',
  },
];

export function LandingFaq() {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      {FAQ_ITEMS.map((item, i) => {
        const isOpen = open === i;
        const num = String(i + 1).padStart(2, '0');
        return (
          <div
            key={item.q}
            className={cn(
              'group/card overflow-hidden rounded-2xl border border-white/[0.1] bg-zinc-900/35 shadow-md backdrop-blur-md transition-all duration-300',
              isOpen &&
                'border-sky-500/35 bg-zinc-900/75 shadow-xl ring-1 shadow-sky-950/40 ring-sky-500/20'
            )}
          >
            <button
              type="button"
              onClick={() => setOpen(isOpen ? null : i)}
              className="flex w-full items-start gap-4 px-6 py-5 text-left transition-colors hover:bg-white/[0.03] md:gap-5 md:px-8 md:py-6"
              aria-expanded={isOpen}
              aria-controls={`faq-panel-${i}`}
              id={`faq-trigger-${i}`}
            >
              <span
                className={cn(
                  'mt-0.5 shrink-0 text-[11px] font-bold tracking-widest text-zinc-600 tabular-nums transition-colors md:text-xs',
                  isOpen && 'text-sky-400/90'
                )}
                aria-hidden
              >
                {num}
              </span>
              <span className="min-w-0 flex-1 pr-2 text-base leading-snug font-semibold tracking-tight text-white md:text-lg">
                {item.q}
              </span>
              <span
                className={cn(
                  'mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/[0.08] bg-white/[0.04] text-zinc-400 transition-all duration-300',
                  'group-hover/card:border-white/15 group-hover/card:bg-white/[0.07] group-hover/card:text-zinc-200',
                  isOpen && 'rotate-180 border-sky-500/30 bg-sky-500/15 text-sky-200'
                )}
              >
                <ChevronDown className="h-4 w-4" strokeWidth={2.5} />
              </span>
            </button>
            <div
              id={`faq-panel-${i}`}
              role="region"
              aria-labelledby={`faq-trigger-${i}`}
              className={cn(
                'grid transition-[grid-template-rows] duration-300 ease-out motion-reduce:transition-none',
                isOpen ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
              )}
            >
              <div className="min-h-0 overflow-hidden">
                <div className="border-t border-white/[0.08] bg-gradient-to-b from-white/[0.02] to-transparent px-6 pt-5 pb-7 md:px-8 md:pt-6 md:pb-8">
                  <p className="text-sm leading-relaxed text-zinc-300 md:text-base md:leading-relaxed">
                    {item.a}
                  </p>
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
