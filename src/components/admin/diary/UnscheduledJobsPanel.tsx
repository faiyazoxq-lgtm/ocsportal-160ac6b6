import { useUnscheduledJobs, findJobIssues } from "@/hooks/useDiaryPlanning";
import { ScheduleConflictBadge } from "./ScheduleConflictBadge";
import { Button } from "@/components/ui/button";

export function UnscheduledJobsPanel({
  filters,
  onScheduleClick,
}: {
  filters: { trade?: string | null; zone?: string | null };
  onScheduleClick: (workOrderId: string) => void;
}) {
  const { data, isLoading, error } = useUnscheduledJobs(filters);

  return (
    <aside className="w-72 shrink-0 rounded-sm border border-border bg-card">
      <header className="border-b border-border px-3 py-2">
        <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
          Unscheduled
        </div>
        <div className="text-sm font-semibold">{data?.length ?? 0} jobs to plan</div>
      </header>
      <div className="max-h-[70vh] overflow-y-auto p-2">
        {isLoading ? (
          <div className="h-20 animate-pulse rounded-sm bg-muted/40" />
        ) : error ? (
          <div className="rounded-sm border border-red-200 bg-red-50 p-2 text-xs text-red-900">
            Failed to load
          </div>
        ) : !data || data.length === 0 ? (
          <div className="rounded-sm border border-dashed border-border p-3 text-center text-xs text-muted-foreground">
            All caught up.
          </div>
        ) : (
          <ul className="space-y-2">
            {data.map((j) => {
              const issues = findJobIssues(j);
              return (
                <li
                  key={j.id}
                  className="rounded-sm border border-border bg-background p-2"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-xs font-medium">{j.order_no}</div>
                      <div className="truncate text-[11px] text-muted-foreground">
                        {j.job_summary}
                      </div>
                    </div>
                    <span
                      className={`text-[9px] font-medium uppercase ${
                        j.priority_level === "urgent"
                          ? "text-red-700"
                          : j.priority_level === "high"
                            ? "text-amber-700"
                            : "text-muted-foreground"
                      }`}
                    >
                      {j.priority_level}
                    </span>
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-1 text-[10px] text-muted-foreground">
                    <span>{null ?? "—"}</span>
                    <span>·</span>
                    <span>{j.postcode_zone ?? "—"}</span>
                    {j.estimated_duration_minutes && (
                      <>
                        <span>·</span>
                        <span>{j.estimated_duration_minutes}m</span>
                      </>
                    )}
                    {j.engineers_required > 1 && (
                      <>
                        <span>·</span>
                        <span>×{j.engineers_required}</span>
                      </>
                    )}
                  </div>
                  {issues.length > 0 && (
                    <div className="mt-1">
                      <ScheduleConflictBadge issues={issues} size="xs" />
                    </div>
                  )}
                  <Button
                    size="sm"
                    variant="outline"
                    className="mt-2 h-7 w-full text-[11px]"
                    onClick={() => onScheduleClick(j.id)}
                  >
                    Schedule
                  </Button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </aside>
  );
}