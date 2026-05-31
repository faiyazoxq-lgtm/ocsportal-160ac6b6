import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { DispatcherShell } from "@/components/DispatcherShell";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { useScheduledJobs } from "@/hooks/useDiaryPlanning";
import { useEngineers } from "@/hooks/useEngineers";
import { useAllAvailability } from "@/hooks/useEngineerAvailability";
import { DiaryFiltersBar, type DiaryFilters } from "@/components/admin/diary/DiaryFiltersBar";
import { DiaryPlanningBoard } from "@/components/admin/diary/DiaryPlanningBoard";
import { UnscheduledJobsPanel } from "@/components/admin/diary/UnscheduledJobsPanel";
import { ScheduleJobDrawer } from "@/components/admin/diary/ScheduleJobDrawer";

export const Route = createFileRoute("/admin/diary")({
  head: () => ({ meta: [{ title: "Diary Planning · OCS" }] }),
  component: DiaryPage,
});

function isoDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

function defaultRange(): { fromDate: string; toDate: string } {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const end = new Date(today);
  end.setDate(end.getDate() + 6);
  return { fromDate: isoDate(today), toDate: isoDate(end) };
}

function DiaryPage() {
  const [filters, setFilters] = useState<DiaryFilters>(defaultRange());
  const [selected, setSelected] = useState<string | null>(null);

  const { data: jobs, isLoading } = useScheduledJobs(filters);
  const { data: engineers } = useEngineers();
  const { data: availability } = useAllAvailability();

  const dates = useMemo(() => {
    const out: string[] = [];
    const start = new Date(filters.fromDate + "T00:00:00");
    const end = new Date(filters.toDate + "T00:00:00");
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      out.push(isoDate(d));
    }
    return out;
  }, [filters.fromDate, filters.toDate]);

  const activeEngineers = useMemo(
    () =>
      (engineers ?? []).filter(
        (e) =>
          e.active_status &&
          (!filters.trade || e.primary_trade === filters.trade) &&
          (!filters.zone || e.covered_postcode_zones?.includes(filters.zone)),
      ),
    [engineers, filters.trade, filters.zone],
  );

  return (
    <ProtectedRoute requireRole="dispatcher">
      <DispatcherShell>
        <div className="mx-auto max-w-[1600px]">
          <AdminPageHeader
            title="Diary Planning"
            description="Plan work into engineer days. Drag-free, dispatcher-driven."
          />
          <DiaryFiltersBar filters={filters} onChange={setFilters} />
          <div className="flex gap-3">
            <UnscheduledJobsPanel
              filters={{ trade: filters.trade, zone: filters.zone }}
              onScheduleClick={setSelected}
            />
            {isLoading ? (
              <div className="h-64 flex-1 animate-pulse rounded-sm bg-muted/40" />
            ) : (
              <DiaryPlanningBoard
                dates={dates}
                engineers={activeEngineers}
                jobs={jobs ?? []}
                availability={availability ?? []}
                onJobClick={setSelected}
              />
            )}
          </div>
          <ScheduleJobDrawer workOrderId={selected} onClose={() => setSelected(null)} />
        </div>
      </DispatcherShell>
    </ProtectedRoute>
  );
}