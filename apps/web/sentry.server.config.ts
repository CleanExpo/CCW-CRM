import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.SENTRY_DSN,

  environment: process.env.ENVIRONMENT || 'development',
  release: process.env.RELEASE || process.env.VERCEL_GIT_COMMIT_SHA,

  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,

  beforeSend(event) {
    // Filter out health check errors
    if (event.request?.url?.includes('/api/health')) {
      return null;
    }

    return event;
  },
});
