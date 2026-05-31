import type { WorkOrderWithRelations } from "@/types/workOrders";
import type { Engineer, EngineerAvailability } from "@/types/engineers";
import { EngineerDayColumn } from "./EngineerDayColumn";
import { useEngineerCapacity } from "@/hooks/useDiaryPlanning";

export function DiaryPlanningBoard({
  dates,
  engineers,
  jobs,
  availability,
  onJobClick,
}: {
  dates: string[];
  engineers: Engineer[];
  jobs: WorkOrderWithRelations[];
  availability: EngineerAvailability[];
  onJobClick: (id: string) => void;
}) {
  const engineerIds = engineers.map((e) => e.id);
  const capacity = useEngineerCapacity(jobs, engineerIds, dates, availability);

  return (
    <div className="flex-1 overflow-x-auto">
      <div className="space-y-3">
        {dates.map((date) => {
          const dateJobs = jobs.filter((j) => j.diary_date === date);
          return (
            <div key={date}>
              <div className="mb-1.5 flex items-center gap-2 px-1">
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {formatDateHeader(date)}
                </span>
                <span className="text-[10px] text-muted-foreground">
                  {dateJobs.length} scheduled
                </span>
              </div>
              <div className="flex gap-2 pb-2">
                {engineers.map((e) => (
                  <EngineerDayColumn
                    key={e.id}
                    engineer={e}
                    date={date}
                    jobs={dateJobs}
                    capacity={capacity.get(`${e.id}|${date}`)}
                    onJobClick={onJobClick}
                  />
                ))}
                <UnassignedColumn date={date} jobs={dateJobs} onJobClick={onJobClick} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function UnassignedColumn({
  date,
  jobs,
  onJobClick,
}: {
  date: string;
  jobs: WorkOrderWithRelations[];
  onJobClick: (id: string) => void;
}) {
  const unassigned = jobs.filter(
    (j) =>
      !(j.assignments ?? []).some((a) =>
        ["assigned", "accepted"].includes(a.assignment_status),
      ),
  );
  if (unassigned.length === 0) return null;
  return (
    <div className="min-w-48 rounded-sm border border-amber-300 bg-amber-50/50">
      <div className="border-b border-amber-200 px-2 py-1.5">
        <div className="text-xs font-medium text-amber-900">Date booked, no engineer</div>
        <div className="text-[10px] text-amber-800">{date}</div>
      </div>
      <div className="space-y-1.5 p-2">
        {unassigned.map((j) => (
          <button
            key={j.id}
            type="button"
            onClick={() => onJobClick(j.id)}
            className="w-full rounded-sm border border-amber-300 bg-background p-1.5 text-left hover:bg-accent/40"
          >
            <div className="text-[11px] font-medium">{j.order_no}</div>
            <div className="truncate text-[10px] text-muted-foreground">{j.job_summary}</div>
          </button>
        ))}
      </div>
    </div>
  );
}

function formatDateHeader(iso: string): string {
  const d = new Date(iso + "T00:00:00");
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diff = Math.round((d.getTime() - today.getTime()) / (24 * 3600 * 1000));
  const weekday = d.toLocaleDateString(undefined, { weekday: "short" });
  const label = `${weekday} ${iso}`;
  if (diff === 0) return `Today · ${label}`;
  if (diff === 1) return `Tomorrow · ${label}`;
  return label;
}