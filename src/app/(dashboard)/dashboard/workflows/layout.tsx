import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Workflows',
  description: 'Trigger-based workflow templates and recent automation runs.',
  robots: { index: false, follow: false },
};

export default function DashboardWorkflowsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="workflows-route-scope relative overflow-hidden rounded-2xl border border-white/10 p-4 md:p-6">
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(100%_70%_at_50%_-30%,hsl(var(--primary)/0.14),transparent_52%)]"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -right-px bottom-0 left-[-1px] h-px bg-gradient-to-r from-transparent via-white/12 to-transparent"
        aria-hidden
      />
      <div className="relative z-[1]">{children}</div>
    </div>
  );
}
