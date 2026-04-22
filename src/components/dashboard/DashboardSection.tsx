import { cn } from '@/lib/utils';

interface DashboardSectionProps {
  /** Optional anchor / `aria-labelledby` target */
  id?: string;
  title: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
}

/**
 * Groups dashboard bento blocks with a consistent heading hierarchy.
 */
export function DashboardSection({
  id,
  title,
  description,
  children,
  className,
}: DashboardSectionProps) {
  const headingId = id ? `${id}-heading` : undefined;

  return (
    <section id={id} aria-labelledby={headingId} className={cn('space-y-6', className)}>
      <header className="relative pl-5">
        <span
          className="absolute inset-y-1 left-0 w-1 rounded-full bg-gradient-to-b from-sky-400 via-indigo-500 to-violet-500 opacity-90 shadow-[0_0_20px_rgba(56,189,248,0.35)]"
          aria-hidden
        />
        <h2 id={headingId} className="text-lg font-bold tracking-tight text-white sm:text-xl">
          {title}
        </h2>
        {description ? (
          <p className="mt-1.5 max-w-3xl text-sm leading-relaxed text-zinc-400">{description}</p>
        ) : null}
      </header>
      {children}
    </section>
  );
}
