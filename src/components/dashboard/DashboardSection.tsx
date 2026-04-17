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
    <section
      id={id}
      aria-labelledby={headingId}
      className={cn('space-y-5', className)}
    >
      <header className="space-y-1.5 border-l-2 border-primary/50 pl-4">
        <h2
          id={headingId}
          className="text-lg font-semibold tracking-tight text-zinc-50"
        >
          {title}
        </h2>
        {description ? (
          <p className="max-w-3xl text-sm leading-relaxed text-zinc-400">
            {description}
          </p>
        ) : null}
      </header>
      {children}
    </section>
  );
}
