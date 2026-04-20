import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@shared'],
  // Enable standalone output for Docker builds
  output: 'standalone',
  experimental: {
    // typedRoutes disabled: marketing pages link to placeholder routes (/privacy, /contact)
    // that don't exist yet; re-enable once those pages are created.
  },
  // Enable source maps for production (Sentry needs these)
  productionBrowserSourceMaps: true,
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**.supabase.co',
      },
      {
        protocol: 'https',
        hostname: 'cdn.shopify.com',
      },
      {
        protocol: 'https',
        hostname: 'cdn.shopifycdn.net',
      },
      {
        protocol: 'https',
        hostname: 'placehold.co',
      },
      {
        protocol: 'https',
        hostname: 'lh3.googleusercontent.com',
      },
    ],
  },
  async headers() {
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
        source: '/:path*',
        headers: [
          // HSTS — 2-year max-age, includeSubDomains, preload-eligible
          // Only effective over HTTPS; browsers ignore on HTTP (safe for local dev)
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload',
          },
          // CSP in report-only mode for 72h observation period (UNI-1915).
          // Flip to Content-Security-Policy once Sentry shows zero violations (UNI-1916).
          {
            key: 'Content-Security-Policy-Report-Only',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.jsdelivr.net",
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
              "font-src 'self' https://fonts.gstatic.com",
              "img-src 'self' data: https: blob:",
              "connect-src 'self' https://*.supabase.co wss://*.supabase.co http://localhost:8000 http://localhost:8001 https://*.sentry.io",
              "frame-ancestors 'none'",
              ...(process.env.SENTRY_CSP_REPORT_URI
                ? [`report-uri ${process.env.SENTRY_CSP_REPORT_URI}`]
                : []),
            ].join('; '),
          },
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=()',
          },
        ],
      },
    ];
  },
};

// Sentry webpack plugin options — only wrap if @sentry/nextjs is installed
let exportedConfig: NextConfig = nextConfig;

try {
  // Dynamic require to avoid build failure when Sentry isn't installed
  const { withSentryConfig } = require('@sentry/nextjs');

  const sentryOptions = {
    // Upload source maps during production build
    silent: true,
    // Suppress logging
    widenClientFileUpload: true,
    // Automatically tree-shake Sentry logger statements to reduce bundle size
    disableLogger: true,
    // Transpile SDK to be compatible with IE11
    transpileClientSDK: true,
    // Hide source maps from generated client bundles
    hideSourceMaps: true,
    // Automatically annotate React components to show in breadcrumbs
    autoInstrumentServerFunctions: true,
  };

  exportedConfig = withSentryConfig(nextConfig, sentryOptions);
} catch {
  // @sentry/nextjs not installed — skip Sentry integration
  console.info('[next.config] @sentry/nextjs not found, Sentry integration disabled');
}

export default exportedConfig;
