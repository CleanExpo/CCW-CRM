/**
 * Lighthouse CI Configuration
 *
 * Performance budgets and thresholds for automated performance testing.
 * Lighthouse analyzes web app performance, accessibility, SEO, and best practices.
 *
 * Installation:
 * - npm i -D @lhci/cli
 *
 * Usage:
 * - Local: npm run test:lighthouse
 * - CI: Runs automatically in GitHub Actions
 *
 * Lighthouse Server (optional):
 * - Self-hosted: https://github.com/GoogleChrome/lighthouse-ci/blob/main/docs/server.md
 * - Or use Lighthouse CI public server
 *
 * Documentation:
 * https://github.com/GoogleChrome/lighthouse-ci/blob/main/docs/configuration.md
 */

// Target defaults to the production alias. Override for a preview deployment:
//   LHCI_TARGET_URL=https://ccw-erp-git-my-branch.vercel.app npm run test:lighthouse
const TARGET = process.env.LHCI_TARGET_URL || 'https://ccw-crm-web.vercel.app';

module.exports = {
  ci: {
    collect: {
      // Audits a deployed target rather than starting a local server. The
      // previous `npm run build && npm run start -- -p 3005` never ran: `start`
      // is `node scripts/production-start.mjs`, which does not take `-p`, and
      // the server needs DATABASE_URL and JWT_SECRET_KEY to boot at all.

      // Only genuinely public routes. `/dashboard` and `/prd/generate` were
      // listed here previously, but both 307-redirect to /login for an
      // unauthenticated client — Lighthouse would have audited the login page
      // three times and reported the scores under the dashboard's name.
      // Authenticated-screen performance is measured in the Playwright suite
      // (`npm run test:e2e`), which logs in first.
      url: [`${TARGET}/`, `${TARGET}/login`, `${TARGET}/register`],

      // Number of runs per URL (more runs = more reliable averages)
      numberOfRuns: 3,

      // Chrome flags
      settings: {
        // `uses-rel-preload` still ships in Lighthouse 12.6.1 but lives in
        // experimental-config, not default-config — so under the default run it
        // is reported as "not a known audit". The experimental preset collects
        // it, which is what lets the assertion below be real instead of noise.
        preset: 'experimental',

        // Use headless Chrome
        chromeFlags: '--no-sandbox --disable-dev-shm-usage',

        // Throttling settings (emulate slow 4G)
        throttling: {
          rttMs: 150,
          throughputKbps: 1638.4,
          requestLatencyMs: 0,
          downloadThroughputKbps: 1638.4,
          uploadThroughputKbps: 675,
          cpuSlowdownMultiplier: 4,
        },

        // Emulate mobile device
        emulatedFormFactor: 'mobile',

        // Screen emulation
        screenEmulation: {
          mobile: true,
          width: 375,
          height: 667,
          deviceScaleFactor: 2,
          disabled: false,
        },
      },
    },

    assert: {
      // Assertions for performance budgets
      preset: 'lighthouse:recommended',

      // AAA honesty: never grade budgets on the best of N runs.
      // LHCI defaults to aggregationMethod=optimistic, which lets a single lucky
      // run green-wash LCP/SI while the median still misses the bar (measured
      // 2026-08-07: gate reported LCP 3105ms while runs were 3105/3393/3853).
      assertions: {
        // Core Web Vitals — median of numberOfRuns must beat the budget
        'first-contentful-paint': [
          'error',
          { maxNumericValue: 2000, aggregationMethod: 'median' },
        ],
        'largest-contentful-paint': [
          'error',
          { maxNumericValue: 2500, aggregationMethod: 'median' },
        ],
        'cumulative-layout-shift': [
          'error',
          { maxNumericValue: 0.1, aggregationMethod: 'median' },
        ],
        'total-blocking-time': [
          'error',
          { maxNumericValue: 300, aggregationMethod: 'median' },
        ],
        'speed-index': [
          'error',
          { maxNumericValue: 3000, aggregationMethod: 'median' },
        ],

        // Overall scores (0-1, where 0.9 = 90%) — median, not best run
        'categories:performance': [
          'error',
          { minScore: 0.9, aggregationMethod: 'median' },
        ],
        'categories:accessibility': [
          'error',
          { minScore: 0.9, aggregationMethod: 'median' },
        ],
        'categories:best-practices': [
          'error',
          { minScore: 0.9, aggregationMethod: 'median' },
        ],
        'categories:seo': ['error', { minScore: 0.9, aggregationMethod: 'median' }],

        // Accessibility
        'color-contrast': 'error',
        'html-has-lang': 'error',
        'image-alt': 'error',
        'label': 'error',
        'meta-viewport': 'error',
        'aria-allowed-attr': 'error',
        'aria-required-attr': 'error',
        'aria-valid-attr': 'error',
        'button-name': 'error',
        'document-title': 'error',
        'link-name': 'error',

        // Best Practices
        'errors-in-console': 'warn',
        'csp-xss': 'warn',
        'deprecations': 'warn',
        // 'uses-https' and 'no-vulnerable-libraries' were asserted here and are
        // removed. Verified against the installed Lighthouse 12.6.1: neither
        // audit file exists under core/audits, and neither appears in
        // default-config or experimental-config. They failed on "auditRan" — a
        // red carrying no information about the product. An assertion that
        // cannot measure anything is a broken gate, not a lenient one.
        //
        // 'uses-rel-preload' was ALSO removed here on the same reasoning, and
        // that was wrong: it still ships, in experimental-config. An independent
        // reviewer caught it. It is restored above, and collect.settings.preset
        // is now 'experimental' so it is genuinely collected.

        // Performance
        'uses-responsive-images': 'warn',
        'uses-optimized-images': 'warn',
        'modern-image-formats': 'warn',
        'uses-text-compression': 'error',
        'uses-rel-preconnect': 'warn',
        'uses-rel-preload': 'warn',
        'font-display': 'warn',
        'unminified-css': 'error',
        'unminified-javascript': 'error',
        'unused-css-rules': 'warn',
        'unused-javascript': 'warn',
        'efficient-animated-content': 'warn',
        'total-byte-weight': ['warn', { maxNumericValue: 1000000 }], // < 1MB

        // SEO
        'meta-description': 'error',
        'robots-txt': 'warn',
        'canonical': 'warn',
        'structured-data': 'warn',

        // PWA (if applicable)
        'viewport': 'error',
        'installable-manifest': 'off', // Turn on if implementing PWA
        'service-worker': 'off', // Turn on if implementing PWA
        'works-offline': 'off', // Turn on if implementing PWA
      },
    },

    upload: {
      // Upload results to Lighthouse CI server (optional)
      // Uncomment and configure if using LHCI server
      // target: 'lhci',
      // serverBaseUrl: 'https://your-lhci-server.com',
      // token: process.env.LHCI_TOKEN,

      // Or use temporary public storage (30 days)
      target: 'temporary-public-storage',
    },
  },
}
