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
    a: 'Architecture documentation describes PostgreSQL in the Asia-Pacific region for Australian operators. Confirm retention, backups, and compliance with your implementation lead before go-live.',
  },
  {
    q: 'Do we get training and support?',
    a: 'User guides cover core modules (products, customers, orders, quotes). Training focuses on role-specific quick starts and discoverable in-app assistance. Enterprise-style runbooks support operations and incidents.',
  },
  {
    q: 'Can we start with a subset of modules?',
    a: 'Absolutely. Many teams begin with quote-to-order and catalog hygiene, then layer inventory sync, procurement, and finance reconciliation. The modular surface area is designed to grow with your operation.',
  },
];

export function LandingFaq() {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <div className="mx-auto max-w-3xl divide-y divide-white/[0.06] border-y border-white/[0.06]">
      {FAQ_ITEMS.map((item, i) => {
        const isOpen = open === i;
        const num = String(i + 1).padStart(2, '0');
        return (
          <div key={item.q}>
            <button
              type="button"
              onClick={() => setOpen(isOpen ? null : i)}
              className="flex w-full items-start gap-4 py-5 text-left transition-colors hover:bg-white/[0.02] md:gap-6 md:py-6"
              aria-expanded={isOpen}
              aria-controls={`faq-panel-${i}`}
              id={`faq-trigger-${i}`}
            >
              <span
                className={cn(
                  // zinc-400, not zinc-600: closed rows sit at 2.58:1 on this #08080c panel,
                  // well under the 4.5:1 AA minimum. The open row recolours to sky and passes,
                  // which is why only the closed indices failed the axe gate.
                  'mt-0.5 shrink-0 text-[12px] font-semibold tracking-widest text-zinc-400 tabular-nums',
                  isOpen && 'text-sky-400/90'
                )}
                aria-hidden
              >
                {num}
              </span>
              <span className="min-w-0 flex-1 pr-2 text-base leading-snug font-semibold tracking-tight text-white md:text-lg">
                {item.q}
              </span>
              <ChevronDown
                className={cn(
                  'mt-1 h-4 w-4 shrink-0 text-zinc-500 transition-transform duration-300',
                  isOpen && 'rotate-180 text-sky-300'
                )}
                strokeWidth={2}
              />
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
                <p className="max-w-2xl pb-6 pl-10 text-sm leading-relaxed text-zinc-400 md:pl-12 md:text-[15px]">
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

export default LandingFaq;
