'use client';

import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

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
    <div className="mx-auto max-w-3xl space-y-3">
      {FAQ_ITEMS.map((item, i) => {
        const isOpen = open === i;
        return (
          <div
            key={item.q}
            className={cn(
              'overflow-hidden rounded-2xl border border-white/[0.08] bg-zinc-900/40 shadow-sm backdrop-blur-sm transition-all duration-300',
              isOpen && 'border-primary/30 bg-zinc-900/70 shadow-lg shadow-primary/10 ring-1 ring-primary/20'
            )}
          >
            <button
              type="button"
              onClick={() => setOpen(isOpen ? null : i)}
              className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left text-base font-semibold text-white md:px-7 md:py-5 md:text-lg"
              aria-expanded={isOpen}
              aria-controls={`faq-panel-${i}`}
              id={`faq-trigger-${i}`}
            >
              <span className="pr-2">{item.q}</span>
              <ChevronDown
                className={cn(
                  'h-5 w-5 shrink-0 text-zinc-500 transition-transform duration-300',
                  isOpen && 'rotate-180 text-primary'
                )}
              />
            </button>
            <div
              id={`faq-panel-${i}`}
              role="region"
              aria-labelledby={`faq-trigger-${i}`}
              className={cn(
                'grid transition-[grid-template-rows] duration-300 ease-out',
                isOpen ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
              )}
            >
              <div className="min-h-0 overflow-hidden">
                <p className="border-t border-white/[0.06] px-5 pb-6 pt-0 text-sm leading-relaxed text-zinc-400 md:px-7 md:text-base md:leading-relaxed">
                  {item.a}
                </p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
