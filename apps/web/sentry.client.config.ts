import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Environment
  environment: process.env.NEXT_PUBLIC_ENVIRONMENT || "development",

  // Release tracking
  release: process.env.NEXT_PUBLIC_RELEASE || process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA,

  // Performance monitoring (10% of transactions in production)
  tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,

  // Session replay (10% of sessions)
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,

  // Integrations
  integrations: [
    Sentry.replayIntegration({
      maskAllText: true,
      blockAllMedia: true,
    }),
  ],

  // Error filtering
  beforeSend(event, hint) {
    // Filter out common browser extension errors
    const ignoreErrors = [
      "ResizeObserver loop limit exceeded",
      "Non-Error promise rejection captured",
      "Network request failed", // Browser offline
    ];

    if (event.exception?.values?.[0]?.value) {
      const errorMessage = event.exception.values[0].value;
      if (ignoreErrors.some((msg) => errorMessage.includes(msg))) {
        return null;
      }
    }

    // Filter out errors from browser extensions
    if (event.request?.url?.includes("chrome-extension://")) {
      return null;
    }

    return event;
  },

  // Ignore specific errors
  ignoreErrors: [
    "ResizeObserver loop limit exceeded",
    "Non-Error promise rejection captured",
    "Network request failed",
    "Load failed",
    "NetworkError when attempting to fetch resource",
    // Browser extension errors
    /^chrome-extension:\/\//,
    /^moz-extension:\/\//,
    /^safari-extension:\/\//,
  ],
});
