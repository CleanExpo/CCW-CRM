import { cn } from '@/lib/utils';

/** Soft mesh behind dashboard content — aligned with marketing home ambient. */
export function DashboardAmbient({ className }: { className?: string }) {
  return (
    <div
      className={cn('pointer-events-none absolute inset-0 -z-10 overflow-hidden rounded-2xl', className)}
      aria-hidden
    >
      <div className="absolute -left-32 top-0 h-80 w-80 rounded-full bg-sky-500/15 blur-3xl" />
      <div className="absolute top-32 -right-24 h-72 w-72 rounded-full bg-indigo-500/12 blur-3xl" />
      <div className="absolute bottom-0 left-1/3 h-64 w-64 rounded-full bg-violet-600/10 blur-3xl" />
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-sky-500/25 to-transparent" />
    </div>
  );
}
