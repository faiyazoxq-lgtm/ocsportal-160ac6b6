import { useMemo } from "react";
import { CalendarClock, OctagonAlert, CheckCircle2 } from "lucide-react";
import { useScheduledJobs } from "@/hooks/useDiaryPlanning";
import { useEngineerAvailability } from "@/hooks/useEngineerAvailability";

/**
 * Compact, read-only summary of a single engineer's day:
 *  - other jobs already scheduled on the date
 *  - any time-off / unavailable block intersecting the date
 *  - total estimated minutes booked
 *
 * Designed to slot into the ScheduleJobDrawer so dispatchers can spot
 * obvious conflicts before saving an assignment.
 */
export function EngineerAvailabilitySummary({
  engineerId,
  date,
  excludeWorkOrderId,
}: {
  engineerId: string | null;
  date: string | null;
  excludeWorkOrderId?: string | null;
}) {
  const enabled = !!engineerId && !!date;
  const { data: jobs } = useScheduledJobs(
    enabled
      ? { fromDate: date!, toDate: date!, engineerId: engineerId! }
      : { fromDate: "1970-01-01", toDate: "1970-01-01" },
  );
  const { data: availability } = useEngineerAvailability(engineerId);

  const otherJobs = useMemo(
    () =>
      (jobs ?? []).filter(
        (j) => j.id !== excludeWorkOrderId && j.diary_date === date,
      ),
    [jobs, date, excludeWorkOrderId],
  );

  const minutes = otherJobs.reduce(
    (sum, j) => sum + (j.estimated_duration_minutes ?? 60),
    0,
  );

  const blocking = useMemo(() => {
    if (!date || !availability) return [];
    return availability.filter((av) => {
      if (av.availability_type === "working_hours") return false;
      const start = av.start_at ? av.start_at.slice(0, 10) : null;
      const end = av.end_at ? av.end_at.slice(0, 10) : start;
      return start && end ? date >= start && date <= end : false;
    });
  }, [availability, date]);

  if (!enabled) return null;

  const overCapacity = minutes > 480;

  return (
    <div className="mt-2 rounded-sm border border-border bg-muted/30 p-2 text-[11px]">
      <div className="flex items-center gap-1.5 font-semibold uppercase tracking-wide text-muted-foreground">
        <CalendarClock className="h-3 w-3" />
        Availability on {date}
      </div>

      {blocking.length > 0 && (
        <div className="mt-1 flex items-start gap-1.5 rounded-sm bg-amber-100 px-1.5 py-1 text-amber-900">
          <OctagonAlert className="mt-0.5 h-3 w-3 shrink-0" />
          <span>
            Marked {blocking[0].availability_type.replace("_", " ")}
            {blocking[0].note ? ` — ${blocking[0].note}` : ""}
          </span>
        </div>
      )}

      <div className="mt-1 flex items-center gap-1.5 text-muted-foreground">
        {otherJobs.length === 0 ? (
          <>
            <CheckCircle2 className="h-3 w-3 text-emerald-600" />
            No other jobs scheduled
          </>
        ) : (
          <span className={overCapacity ? "text-amber-700" : ""}>
            {otherJobs.length} other job{otherJobs.length === 1 ? "" : "s"} · {minutes} min booked
            {overCapacity ? " (over 8h)" : ""}
          </span>
        )}
      </div>

      {otherJobs.length > 0 && (
        <ul className="mt-1 space-y-0.5">
          {otherJobs.slice(0, 4).map((j) => (
            <li key={j.id} className="truncate text-muted-foreground">
              · {j.order_no} {j.diary_slot_label ? `(${j.diary_slot_label})` : ""}{" "}
              <span className="text-foreground/70">{j.job_summary}</span>
            </li>
          ))}
          {otherJobs.length > 4 && (
            <li className="text-muted-foreground">… {otherJobs.length - 4} more</li>
          )}
        </ul>
      )}
    </div>
  );
}