import { createFileRoute } from "@tanstack/react-router";
import { CalendarDays, Wrench, RefreshCw } from "lucide-react";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { EngineerShell } from "@/components/EngineerShell";

export const Route = createFileRoute("/engineer")({
  head: () => ({ meta: [{ title: "Engineer · OCS" }] }),
  component: EngineerPage,
});

function EngineerPage() {
  return (
    <ProtectedRoute requireRole="engineer">
      <EngineerShell>
        <section className="space-y-4">
          <header>
            <h1 className="text-base font-semibold text-foreground">Today</h1>
            <p className="text-xs text-muted-foreground">
              Your scheduled work and outstanding tasks.
            </p>
          </header>

          <PanelCard
            icon={<CalendarDays className="h-4 w-4" />}
            title="Today's diary"
            description="Scheduled jobs for today will appear here."
          />
          <PanelCard
            icon={<Wrench className="h-4 w-4" />}
            title="Outstanding jobs"
            description="Open and in-progress work orders assigned to you."
          />
          <PanelCard
            icon={<RefreshCw className="h-4 w-4" />}
            title="Sync status"
            description="All field updates are up to date."
            status="Up to date"
          />
        </section>
      </EngineerShell>
    </ProtectedRoute>
  );
}

function PanelCard({
  icon,
  title,
  description,
  status,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  status?: string;
}) {
  return (
    <div className="rounded-md border border-border bg-card p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground">{icon}</span>
          <h2 className="text-sm font-semibold text-foreground">{title}</h2>
        </div>
        {status ? (
          <span className="rounded-sm border border-border bg-muted px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
            {status}
          </span>
        ) : null}
      </div>
      <p className="mt-2 text-xs text-muted-foreground">{description}</p>
      <div className="mt-4 rounded-sm border border-dashed border-border px-3 py-6 text-center text-[11px] text-muted-foreground">
        Module not yet enabled.
      </div>
    </div>
  );
}