import type { WorkOrderWithRelations } from "@/types/workOrders";
import type { Engineer } from "@/types/engineers";
import type { EngineerCapacity } from "@/hooks/useDiaryPlanning";
import { findJobIssues } from "@/hooks/useDiaryPlanning";
import { ScheduleConflictBadge } from "./ScheduleConflictBadge";
import { CapacityIndicator } from "./CapacityIndicator";

export function EngineerDayColumn({
  engineer,
  date,
  jobs,
  capacity,
  onJobClick,
}: {
  engineer: Engineer;
  date: string;
  jobs: WorkOrderWithRelations[];
  capacity: EngineerCapacity | undefined;
  onJobClick: (id: string) => void;
}) {
  const myJobs = jobs.filter((j) =>
    j.assignments?.some(
      (a) =>
        a.engineer?.id === engineer.id &&
        ["assigned", "accepted"].includes(a.assignment_status),
    ),
  );

  return (
    <div className="min-w-48 rounded-sm border border-border bg-card">
      <div className="border-b border-border px-2 py-1.5">
        <div className="flex items-center justify-between">
          <div className="truncate text-xs font-medium">{engineer.display_name}</div>
          {capacity?.unavailable && (
            <span className="text-[9px] font-medium uppercase text-red-700">Off</span>
          )}
        </div>
        <div className="text-[10px] text-muted-foreground">{"—"}</div>
        <div className="mt-1">
          <CapacityIndicator capacity={capacity} />
        </div>
        {capacity?.conflicts && capacity.conflicts.length > 0 && (
          <div className="mt-1">
            <ScheduleConflictBadge issues={capacity.conflicts} size="xs" />
          </div>
        )}
      </div>
      <div className="min-h-32 space-y-1.5 p-2">
        {myJobs.length === 0 ? (
          <div className="rounded-sm border border-dashed border-border p-2 text-center text-[10px] text-muted-foreground">
            No jobs
          </div>
        ) : (
          myJobs.map((j) => {
            const issues = findJobIssues(j);
            const role = j.assignments?.find((a) => a.engineer?.id === engineer.id)
              ?.assignment_role;
            const start = j.scheduled_start_at
              ? new Date(j.scheduled_start_at).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })
              : j.diary_slot_label;
            return (
              <button
                key={j.id}
                type="button"
                onClick={() => onJobClick(j.id)}
                className="w-full rounded-sm border border-border bg-background p-1.5 text-left hover:bg-accent/40"
              >
                <div className="flex items-center justify-between gap-1">
                  <span className="text-[11px] font-medium">{j.order_no}</span>
                  <span className="text-[9px] uppercase text-muted-foreground">{role}</span>
                </div>
                <div className="truncate text-[10px] text-muted-foreground">{j.job_summary}</div>
                <div className="mt-0.5 flex items-center justify-between text-[10px] text-muted-foreground">
                  <span>
                    {start ?? "—"}
                    {j.estimated_duration_minutes ? ` · ${j.estimated_duration_minutes}m` : ""}
                  </span>
                  <span>{j.postcode_zone ?? ""}</span>
                </div>
                {issues.length > 0 && (
                  <div className="mt-1">
                    <ScheduleConflictBadge issues={issues} size="xs" />
                  </div>
                )}
              </button>
            );
          })
        )}
      </div>
      <div className="border-t border-border px-2 py-1 text-[10px] text-muted-foreground">{date}</div>
    </div>
  );
}