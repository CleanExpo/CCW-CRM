// Next.js instrumentation hook — currently a no-op.
// Sentry was removed in UNI-1949 (prod 500 caused by deprecated withSentryConfig v7 options in Sentry v10+).
// Re-add observability wiring here if/when a replacement is adopted.
export async function register() {}
