import { createFileRoute } from "@tanstack/react-router";
import { Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { CalendarDays, Wrench, History } from "lucide-react";
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
  const [tab, setTab] = useState<"outstanding" | "previous">("outstanding");

  const today = new Date().toISOString().slice(0, 10);
  const { todays, outstanding, previous } = useMemo(() => {
    const list = jobs ?? [];
    const completedStatuses = [
      "field_submitted_complete",
      "dispatcher_review",
      "follow_up_required",
      "closed",
      "cancelled",
    ];
    return {
      todays: list.filter((j) => j.diary_date === today),
      outstanding: list.filter(
        (j) =>
          j.diary_date !== today &&
          !completedStatuses.includes(j.current_status),
      ),
      previous: list
        .filter((j) => completedStatuses.includes(j.current_status))
        .sort((a, b) =>
          (b.updated_at ?? b.created_at).localeCompare(
            a.updated_at ?? a.created_at,
          ),
        ),
    };
  }, [jobs, today]);

  return (
    <ProtectedRoute requireRole="engineer">
      <EngineerShell>
        <section className="space-y-4">
          <header>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Today</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Your scheduled jobs, outstanding work and history — all in one place.
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

          {/* Today's jobs always sit at the top */}
          <Section
            icon={<CalendarDays className="h-4 w-4" />}
            title="Today's diary"
            empty="No jobs scheduled for today."
            loading={isLoading}
            items={todays}
            meId={me?.id ?? null}
          />

          {/* Tabs for outstanding vs previous, sitting directly below today */}
          <div className="space-y-2">
            <div
              role="tablist"
              aria-label="Your jobs"
              className="inline-flex w-full rounded-md border border-border bg-muted/30 p-1.5"
            >
              <TabButton
                active={tab === "outstanding"}
                onClick={() => setTab("outstanding")}
                icon={<Wrench className="h-3.5 w-3.5" />}
                label="Outstanding"
                count={outstanding.length}
              />
              <TabButton
                active={tab === "previous"}
                onClick={() => setTab("previous")}
                icon={<History className="h-3.5 w-3.5" />}
                label="Previous jobs"
                count={previous.length}
              />
            </div>

            {tab === "outstanding" ? (
              <Section
                icon={<Wrench className="h-4 w-4" />}
                title="Outstanding jobs"
                empty="Nothing outstanding."
                loading={isLoading}
                items={outstanding}
                meId={me?.id ?? null}
                hideHeader
              />
            ) : (
              <Section
                icon={<History className="h-4 w-4" />}
                title="Previous jobs"
                empty="No previous jobs yet. Completed work will show up here."
                loading={isLoading}
                items={previous}
                meId={me?.id ?? null}
                hideHeader
              />
            )}
          </div>

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

function TabButton({
  active,
  onClick,
  icon,
  label,
  count,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  count: number;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={`flex-1 inline-flex items-center justify-center gap-2 rounded-sm px-4 py-2.5 text-sm font-bold transition ${
        active
          ? "bg-background text-foreground shadow-sm"
          : "text-muted-foreground hover:text-foreground"
      }`}
    >
      {icon}
      {label}
      <span className="rounded-sm bg-muted px-1.5 py-0.5 text-[11px] font-semibold text-muted-foreground">
        {count}
      </span>
    </button>
  );
}

function Section({
  icon,
  title,
  empty,
  loading,
  items,
  meId,
  hideHeader,
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
  hideHeader?: boolean;
}) {
  return (
    <div className="space-y-2">
      {hideHeader ? null : (
        <div className="flex items-center gap-2 px-1">
          <span className="text-muted-foreground">{icon}</span>
          <h2 className="text-lg font-bold text-foreground">{title}</h2>
          {items?.length ? (
            <span className="rounded-sm bg-muted px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              {items.length}
            </span>
          ) : null}
        </div>
      )}
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