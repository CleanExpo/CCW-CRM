import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  output: 'standalone',
  serverExternalPackages: ['pg'],
  typedRoutes: false,
  productionBrowserSourceMaps: false,
  async redirects() {
    return [
      { source: '/orders/fulfilment', destination: '/dashboard/operations/fulfilment', permanent: false },
      { source: '/orders', destination: '/dashboard/operations/orders', permanent: false },
      { source: '/orders/:path*', destination: '/dashboard/operations/orders/:path*', permanent: false },
      { source: '/quotes', destination: '/dashboard/operations/quotes', permanent: false },
      { source: '/quotes/:path*', destination: '/dashboard/operations/quotes/:path*', permanent: false },
      {
        source: '/purchase-orders/receiving',
        destination: '/dashboard/operations/purchase-orders/receiving',
        permanent: false,
      },
      { source: '/purchase-orders', destination: '/dashboard/operations/purchase-orders', permanent: false },
      {
        source: '/purchase-orders/:path*',
        destination: '/dashboard/operations/purchase-orders/:path*',
        permanent: false,
      },
      { source: '/pos/reconciliation', destination: '/dashboard/operations/pos/reconciliation', permanent: false },
      { source: '/pos', destination: '/dashboard/operations/pos', permanent: false },
      { source: '/pos/:path*', destination: '/dashboard/operations/pos/:path*', permanent: false },
      { source: '/submissions', destination: '/dashboard/operations/submissions', permanent: false },
      { source: '/submissions/:path*', destination: '/dashboard/operations/submissions/:path*', permanent: false },
      { source: '/products', destination: '/dashboard/inventory/products', permanent: false },
      { source: '/products/:path*', destination: '/dashboard/inventory/products/:path*', permanent: false },
      { source: '/inventory', destination: '/dashboard/inventory', permanent: false },
      { source: '/inventory/:path*', destination: '/dashboard/inventory/:path*', permanent: false },
      { source: '/warehouse', destination: '/dashboard/inventory/warehouse', permanent: false },
      { source: '/warehouse/:path*', destination: '/dashboard/inventory/warehouse/:path*', permanent: false },
      { source: '/containers', destination: '/dashboard/inventory/containers', permanent: false },
      { source: '/containers/:path*', destination: '/dashboard/inventory/containers/:path*', permanent: false },
      { source: '/backorders', destination: '/dashboard/inventory/backorders', permanent: false },
      { source: '/backorders/:path*', destination: '/dashboard/inventory/backorders/:path*', permanent: false },
      { source: '/customers/health', destination: '/dashboard/crm/client-health', permanent: false },
      { source: '/customers/onboarding', destination: '/dashboard/crm/onboarding', permanent: false },
      { source: '/customers/personas', destination: '/dashboard/crm/personas', permanent: false },
      { source: '/customers', destination: '/dashboard/crm/customers', permanent: false },
      { source: '/customers/:path*', destination: '/dashboard/crm/customers/:path*', permanent: false },
      { source: '/contacts', destination: '/dashboard/crm/contacts', permanent: false },
      { source: '/contacts/:path*', destination: '/dashboard/crm/contacts/:path*', permanent: false },
      { source: '/contractors', destination: '/dashboard/crm/contractors', permanent: false },
      { source: '/contractors/:path*', destination: '/dashboard/crm/contractors/:path*', permanent: false },
      { source: '/service-requests', destination: '/dashboard/crm/service-requests', permanent: false },
      {
        source: '/service-requests/:path*',
        destination: '/dashboard/crm/service-requests/:path*',
        permanent: false,
      },
      { source: '/activities', destination: '/dashboard/crm/activities', permanent: false },
      { source: '/activities/:path*', destination: '/dashboard/crm/activities/:path*', permanent: false },
      { source: '/workshop', destination: '/dashboard/workshop', permanent: false },
      { source: '/workshop/:path*', destination: '/dashboard/workshop/:path*', permanent: false },
      { source: '/invoices', destination: '/dashboard/finance/invoices', permanent: false },
      { source: '/invoices/:path*', destination: '/dashboard/finance/invoices/:path*', permanent: false },
      { source: '/bank-feeds', destination: '/dashboard/finance/bank-feeds', permanent: false },
      { source: '/bank-feeds/:path*', destination: '/dashboard/finance/bank-feeds/:path*', permanent: false },
      { source: '/emails', destination: '/dashboard/finance/emails', permanent: false },
      { source: '/emails/:path*', destination: '/dashboard/finance/emails/:path*', permanent: false },
      { source: '/ai-assistant', destination: '/dashboard/ai-reports/ai-assistant', permanent: false },
      { source: '/ai-ops', destination: '/dashboard/ai-reports/ai-ops', permanent: false },
      { source: '/ai-query', destination: '/dashboard/ai-reports/ai-query', permanent: false },
      { source: '/prd/generate', destination: '/dashboard/ai-reports/prd/generate', permanent: false },
      { source: '/prd/:path*', destination: '/dashboard/ai-reports/prd/:path*', permanent: false },
      { source: '/insights', destination: '/dashboard/ai-reports/insights', permanent: false },
      { source: '/insights/:path*', destination: '/dashboard/ai-reports/insights/:path*', permanent: false },
      { source: '/reports', destination: '/dashboard/ai-reports/reports', permanent: false },
      { source: '/reports/:path*', destination: '/dashboard/ai-reports/reports/:path*', permanent: false },
      { source: '/marketing', destination: '/dashboard/ai-reports/marketing', permanent: false },
      { source: '/marketing/:path*', destination: '/dashboard/ai-reports/marketing/:path*', permanent: false },
      { source: '/marketplace', destination: '/dashboard/ai-reports/marketplace', permanent: false },
      { source: '/marketplace/:path*', destination: '/dashboard/ai-reports/marketplace/:path*', permanent: false },
      { source: '/workflows', destination: '/dashboard/workflows', permanent: false },
      { source: '/workflows/:path*', destination: '/dashboard/workflows/:path*', permanent: false },
    ];
  },
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**.supabase.co' },
      { protocol: 'https', hostname: 'cdn.shopify.com' },
      { protocol: 'https', hostname: 'cdn.shopifycdn.net' },
      { protocol: 'https', hostname: 'placehold.co' },
      { protocol: 'https', hostname: 'lh3.googleusercontent.com' },
    ],
  },
  async headers() {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const upstreamUrl =
      process.env.API_UPSTREAM_URL?.trim() ||
      process.env.NEXT_PUBLIC_BACKEND_URL?.trim();
    const connectSrcParts = [
      "'self'",
      'https://*.supabase.co',
      'wss://*.supabase.co',
      appUrl,
      ...(upstreamUrl ? [upstreamUrl] : []),
      ...(process.env.NODE_ENV === 'development' ? ['http://localhost:8001'] : []),
    ];
    const hsts =
      process.env.NODE_ENV === 'production'
        ? [{ key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' }]
        : [];

    return [
      {
        source: '/api/:path*',
        headers: [
          { key: 'Access-Control-Allow-Credentials', value: 'true' },
          {
            key: 'Access-Control-Allow-Origin',
            value: process.env.NEXT_PUBLIC_FRONTEND_URL || 'http://localhost:3000',
          },
          { key: 'Access-Control-Allow-Methods', value: 'GET,POST,PUT,DELETE,OPTIONS' },
          {
            key: 'Access-Control-Allow-Headers',
            value:
              'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version',
          },
        ],
      },
      {
        source: '/mobile/:path*',
        headers: [
          {
            key: 'Permissions-Policy',
            value: 'camera=(self), microphone=(), geolocation=()',
          },
        ],
      },
      {
        source: '/guest/:path*',
        headers: [
          {
            key: 'Permissions-Policy',
            value: 'camera=(self), microphone=(), geolocation=()',
          },
        ],
      },
      {
        source: '/:path*',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.jsdelivr.net",
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
              "font-src 'self' https://fonts.gstatic.com",
              "img-src 'self' data: https: blob:",
              `connect-src ${connectSrcParts.join(' ')}`,
              "frame-ancestors 'none'",
            ].join('; '),
          },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=()',
          },
          ...hsts,
        ],
      },
    ];
  },
};

export default nextConfig;
