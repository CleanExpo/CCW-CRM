/** Inline JSON-LD script tag — avoids `next/script` lazy-loading quirks in Webpack dev. */
interface JsonLdProps {
  data: Record<string, unknown> | Record<string, unknown>[];
  id?: string;
}

export function JsonLd({ data, id }: JsonLdProps) {
  return (
    <script
      id={id || 'json-ld'}
      type="application/ld+json"
      suppressHydrationWarning
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(Array.isArray(data) ? data : data),
      }}
    />
  );
}

interface AggregateRatingProps {
  ratingValue: number;
  reviewCount: number;
  bestRating?: number;
  worstRating?: number;
}

interface ProductSchemaProps {
  name: string;
  description?: string;
  sku?: string;
  brand?: string;
  price?: string;
  currency?: string;
  availability?: 'InStock' | 'OutOfStock' | 'LimitedAvailability' | 'PreOrder';
  image?: string;
  url?: string;
  aggregateRating?: AggregateRatingProps;
  category?: string;
}

export function ProductSchema({
  name,
  description,
  sku,
  brand = 'CCW Online',
  price,
  currency = 'AUD',
  availability = 'InStock',
  image,
  url,
  aggregateRating,
  category,
}: ProductSchemaProps) {
  // Price valid until 1 year from now
  const priceValidUntil = new Date();
  priceValidUntil.setFullYear(priceValidUntil.getFullYear() + 1);

  const productData: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: name,
    ...(description && { description: description }),
    ...(sku && { sku: sku, mpn: sku }),
    brand: {
      '@type': 'Brand',
      name: brand,
    },
    ...(category && { category: category }),
    ...(image && { image: image }),
    ...(url && { url: url }),
    offers: {
      '@type': 'Offer',
      priceCurrency: currency,
      ...(price && { price: price }),
      availability: `https://schema.org/${availability}`,
      priceValidUntil: priceValidUntil.toISOString().split('T')[0],
      itemCondition: 'https://schema.org/NewCondition',
      seller: {
        '@type': 'Organization',
        '@id': 'https://ccwonline.com.au/#organization',
        name: 'CCW Online',
      },
    },
    ...(aggregateRating && {
      aggregateRating: {
        '@type': 'AggregateRating',
        ratingValue: aggregateRating.ratingValue.toString(),
        reviewCount: aggregateRating.reviewCount.toString(),
        bestRating: (aggregateRating.bestRating ?? 5).toString(),
        worstRating: (aggregateRating.worstRating ?? 1).toString(),
      },
    }),
  };

  return (
    <JsonLd
      id={`product-schema-${sku || name.toLowerCase().replace(/\s+/g, '-')}`}
      data={productData}
    />
  );
}
