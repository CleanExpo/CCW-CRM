import type { Metadata } from 'next';
import { FaqSchema } from '@/components/seo/FaqSchema';
import { FAQ_ITEMS } from '@/components/seo/FaqSchema';
import { ErrorBoundary } from '@/components/errors/ErrorBoundary';

export const metadata: Metadata = {
  title: 'FAQ - Carpet Cleaning Equipment & Restoration',
  description:
    'Frequently asked questions about professional carpet cleaning equipment, IICRC training, water damage restoration, and CCW Online services.',
};

export default function FaqPage() {
  return (
    <ErrorBoundary>
      <>
        <FaqSchema />
        <div className="container mx-auto max-w-4xl px-4 py-8">
          <h1 className="mb-2 text-3xl font-bold">Frequently Asked Questions</h1>
          <p className="text-muted-foreground mb-8">
            Expert answers about carpet cleaning equipment, restoration, and CCW Online services.
          </p>
          <div className="space-y-6">
            {FAQ_ITEMS.map((item, index) => (
              <div key={index} className="rounded-lg border p-6">
                <h2 className="mb-3 text-lg font-semibold">{item.question}</h2>
                <p className="text-muted-foreground leading-relaxed">{item.answer}</p>
              </div>
            ))}
          </div>
        </div>
      </>
    </ErrorBoundary>
  );
}
