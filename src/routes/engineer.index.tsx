import { createFileRoute } from "@tanstack/react-router";
import { Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { CalendarDays, Wrench } from "lucide-react";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { EngineerShell } from "@/components/EngineerShell";
import {
  useEngineerAssignedJobs,
  useCurrentEngineer,
} from "@/hooks/useEngineerJobs";
import { EngineerJobCard } from "@/components/engineer/EngineerJobCard";

export const Route = createFileRoute("/engineer/")({
  head: () => ({ meta: [{ title: "Engineer · OCS" }] }),
  component: EngineerPage,
});

function EngineerPage() {
  const { data: me } = useCurrentEngineer();
  const { data: jobs, isLoading } = useEngineerAssignedJobs();

  const today = new Date().toISOString().slice(0, 10);
  const { todays, outstanding } = useMemo(() => {
    const list = jobs ?? [];
    return {
      todays: list.filter((j) => j.diary_date === today),
      outstanding: list.filter(
        (j) =>
          j.diary_date !== today &&
          ![
            "field_submitted_complete",
            "dispatcher_review",
            "closed",
            "cancelled",
          ].includes(j.current_status),
      ),
    };
  }, [jobs, today]);

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

          {!me ? (
            <div className="rounded-md border border-amber-300/60 bg-amber-50 p-4 text-xs text-amber-900 dark:bg-amber-950/40 dark:text-amber-100">
              <div className="font-semibold">No engineer profile linked</div>
              <p className="mt-1">
                Ask a dispatcher to link your account to an engineer record before jobs can be assigned to you.
              </p>
            </div>
          ) : null}

          <Section
            icon={<CalendarDays className="h-4 w-4" />}
            title="Today's diary"
            empty="No jobs scheduled for today."
            loading={isLoading}
            items={todays}
            meId={me?.id ?? null}
          />
          <Section
            icon={<Wrench className="h-4 w-4" />}
            title="Outstanding jobs"
            empty="Nothing outstanding."
            loading={isLoading}
            items={outstanding}
            meId={me?.id ?? null}
          />

          <div className="pt-1 text-center text-[11px]">
            <Link to="/engineer/jobs" className="text-muted-foreground underline-offset-2 hover:underline">
              See all assigned jobs →
            </Link>
          </div>
        </section>
      </EngineerShell>
    </ProtectedRoute>
  );
}

function Section({
  icon,
  title,
  empty,
  loading,
  items,
  meId,
}: {
  icon: React.ReactNode;
  title: string;
  empty: string;
  loading: boolean;
  items: ReturnType<typeof useEngineerAssignedJobs>["data"] extends infer T
    ? T extends Array<infer U>
      ? U[]
      : never
    : never;
  meId: string | null;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 px-1">
        <span className="text-muted-foreground">{icon}</span>
        <h2 className="text-sm font-semibold text-foreground">{title}</h2>
        {items?.length ? (
          <span className="rounded-sm bg-muted px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            {items.length}
          </span>
        ) : null}
      </div>
      {loading ? (
        <div className="rounded-md border border-border bg-card p-3 text-center text-xs text-muted-foreground">
          Loading…
        </div>
      ) : !items?.length ? (
        <div className="rounded-md border border-dashed border-border bg-card p-4 text-center text-xs text-muted-foreground">
          {empty}
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((j) => (
            <EngineerJobCard key={j.id} job={j} currentEngineerId={meId} />
          ))}
        </div>
      )}
    </div>
  );
}