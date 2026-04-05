import { MetadataRoute } from 'next';

const BASE_URL = 'https://ccwonline.com.au';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      // Standard search crawlers — full access to public pages
      {
        userAgent: 'Googlebot',
        allow: '/',
        disallow: [
          '/api/',
          '/dashboard',
          '/products',
          '/customers',
          '/orders',
          '/quotes',
          '/reports',
          '/settings',
        ],
      },
      {
        userAgent: 'Bingbot',
        allow: '/',
        disallow: [
          '/api/',
          '/dashboard',
          '/products',
          '/customers',
          '/orders',
          '/quotes',
          '/reports',
          '/settings',
        ],
      },
      // AI/LLM crawlers — explicitly allowed on public content (GEO-01)
      {
        userAgent: 'GPTBot',
        allow: '/',
        disallow: [
          '/api/',
          '/dashboard',
          '/products',
          '/customers',
          '/orders',
          '/quotes',
          '/reports',
          '/settings',
        ],
      },
      {
        userAgent: 'ClaudeBot',
        allow: '/',
        disallow: [
          '/api/',
          '/dashboard',
          '/products',
          '/customers',
          '/orders',
          '/quotes',
          '/reports',
          '/settings',
        ],
      },
      {
        userAgent: 'PerplexityBot',
        allow: '/',
        disallow: [
          '/api/',
          '/dashboard',
          '/products',
          '/customers',
          '/orders',
          '/quotes',
          '/reports',
          '/settings',
        ],
      },
      {
        userAgent: 'Googlebot-Extended',
        allow: '/',
        disallow: [
          '/api/',
          '/dashboard',
          '/products',
          '/customers',
          '/orders',
          '/quotes',
          '/reports',
          '/settings',
        ],
      },
      {
        userAgent: 'CCBot',
        allow: '/',
        disallow: [
          '/api/',
          '/dashboard',
          '/products',
          '/customers',
          '/orders',
          '/quotes',
          '/reports',
          '/settings',
        ],
      },
      {
        userAgent: 'Meta-ExternalAgent',
        allow: '/',
        disallow: [
          '/api/',
          '/dashboard',
          '/products',
          '/customers',
          '/orders',
          '/quotes',
          '/reports',
          '/settings',
        ],
      },
      {
        userAgent: 'Applebot-Extended',
        allow: '/',
        disallow: [
          '/api/',
          '/dashboard',
          '/products',
          '/customers',
          '/orders',
          '/quotes',
          '/reports',
          '/settings',
        ],
      },
      {
        userAgent: 'YouBot',
        allow: '/',
        disallow: [
          '/api/',
          '/dashboard',
          '/products',
          '/customers',
          '/orders',
          '/quotes',
          '/reports',
          '/settings',
        ],
      },
    ],
    sitemap: `${BASE_URL}/sitemap.xml`,
  };
}
