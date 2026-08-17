export async function register() {
  if (process.env.NEXT_RUNTIME && process.env.NEXT_RUNTIME !== 'nodejs') return;
  if (process.env.NEXT_PHASE === 'phase-production-build') return;
  if (process.env.VITEST || process.env.NODE_ENV === 'test') return;

  await import('./instrumentation.node');
}
