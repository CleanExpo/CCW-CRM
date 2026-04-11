import type { Metadata } from 'next';
import { ProductPublicPage } from '@/components/landing/pages/product-public-page';

export const metadata: Metadata = {
  title: 'Product — CCW Online ERP',
  description:
    'One operational spine for equipment suppliers: quote-to-cash, inventory, finance hand-offs, and integrations—built for Australian wholesale reality.',
};

export default function ProductPage() {
  return <ProductPublicPage />;
}
