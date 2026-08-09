import { Plus_Jakarta_Sans, Syne } from 'next/font/google';

/** Body / UI — geometric, highly legible at small sizes. */
export const marketingBody = Plus_Jakarta_Sans({
  subsets: ['latin'],
  display: 'swap',
  preload: true,
  adjustFontFallback: true,
  variable: '--font-marketing-body',
});

/** Display — distinctive, modern, non-generic SaaS. */
export const marketingDisplay = Syne({
  subsets: ['latin'],
  display: 'swap',
  preload: true,
  weight: ['500', '600', '700', '800'],
  variable: '--font-marketing-display',
});

/** Root class: both families as CSS variables + body as default. */
export const marketingFont = {
  className: `${marketingBody.className} ${marketingBody.variable} ${marketingDisplay.variable}`,
  variable: `${marketingBody.variable} ${marketingDisplay.variable}`,
};
