import { withSentryConfig } from '@sentry/nextjs';
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@shared'],
  // Enable standalone output for Docker builds
  output: 'standalone',
  experimental: {
    typedRoutes: false,
  },
  // Disable browser source maps in production (Sentry uses server-side upload only)
  productionBrowserSourceMaps: false,
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
      // Mobile order routes — allow camera for photo capture
      {
        source: '/mobile/:path*',
        headers: [
          {
            key: 'Permissions-Policy',
            value: 'camera=(self), microphone=(), geolocation=()',
          },
        ],
      },
      // Guest order portal — allow camera for mobile devices viewing their order
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
              "connect-src 'self' https://*.supabase.co wss://*.supabase.co http://localhost:8000 http://localhost:8001 https://*.sentry.io",
              "frame-ancestors 'none'",
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

// Sentry webpack plugin options
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

export default withSentryConfig(nextConfig, sentryOptions);
