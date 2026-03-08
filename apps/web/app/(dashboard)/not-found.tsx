import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function DashboardNotFound() {
  return (
    <div className="flex min-h-[400px] flex-col items-center justify-center gap-4 p-8">
      <h2 className="text-4xl font-bold">404</h2>
      <h3 className="text-lg font-semibold">Page not found</h3>
      <p className="text-sm text-muted-foreground">
        This dashboard page does not exist.
      </p>
      <Button asChild variant="default">
        <Link href="/dashboard">Back to Dashboard</Link>
      </Button>
    </div>
  );
}
