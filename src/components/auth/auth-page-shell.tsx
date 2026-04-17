import { marketingShell } from '@/components/landing/marketing-shell';
import { Card, CardContent, CardDescription, CardHeader } from '@/components/ui/card';
import { cn } from '@/lib/utils';

export function AuthPageShell({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        marketingShell,
        'flex min-h-[calc(100vh-12rem)] flex-col items-center justify-center py-16 md:py-24'
      )}
    >
      <Card className="w-full max-w-md border border-white/[0.08] bg-zinc-950/85 text-zinc-50 shadow-2xl shadow-black/50 ring-1 ring-white/10 backdrop-blur-xl">
        <CardHeader className="space-y-1 pb-2">
          <h1 className="text-center text-2xl font-bold tracking-tight text-white">{title}</h1>
          {description ? (
            <CardDescription className="text-center text-sm text-zinc-400">{description}</CardDescription>
          ) : null}
        </CardHeader>
        <CardContent className="pt-2">{children}</CardContent>
      </Card>
    </div>
  );
}
