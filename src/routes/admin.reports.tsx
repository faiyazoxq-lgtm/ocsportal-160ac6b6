import { createFileRoute } from "@tanstack/react-router";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { DispatcherShell } from "@/components/DispatcherShell";
import { ReportsShell } from "@/components/admin/reports/ReportsShell";
import { KpiCard, ReportSection } from "@/components/admin/reports/KpiCard";
import { TrendLine, BarBreakdown } from "@/components/admin/reports/Charts";
import { ReportFiltersBar } from "@/components/admin/reports/ReportFilters";
import {
  useIntakeReports,
  useOperationsReports,
  useReportFilters,
} from "@/hooks/useReports";
import { buildDaySeries, countBy, fmtInt, fmtPct } from "@/lib/reportFormatters";
import { Inbox, ClipboardList, AlertTriangle, RefreshCw } from "lucide-react";

export const Route = createFileRoute("/admin/reports")({
  head: () => ({ meta: [{ title: "Reports · OCS" }] }),
  component: ReportsOverviewPage,
});

function ReportsOverviewPage() {
  const { filters, setFilters, setDays } = useReportFilters(30);
  const intake = useIntakeReports(filters);
  const ops = useOperationsReports(filters);

  const intakeRows = intake.data ?? [];
  const opsRows = ops.data ?? [];

  const needsReview = intakeRows.filter((r) => r.parse_status === "needs_review").length;
  const duplicates = intakeRows.filter(
    (r) => (r.duplicate_candidates_json?.length ?? 0) > 0 || r.parse_status === "duplicate_suspected",
  ).length;
  const converted = intakeRows.filter((r) => r.parse_status === "converted").length;
  const rejected = intakeRows.filter((r) => r.parse_status === "rejected").length;

  const unassigned = opsRows.filter(
    (w) => (w.assignments?.length ?? 0) === 0 && !["closed", "cancelled", "ignored"].includes(w.current_status),
  ).length;
  const inFlight = opsRows.filter((w) =>
    ["assigned", "accepted", "en_route", "on_site", "field_in_progress"].includes(w.current_status),
  ).length;
  const review = opsRows.filter((w) =>
    ["dispatcher_review", "field_submitted_complete", "field_submitted_incomplete", "follow_up_required"].includes(
      w.current_status,
    ),
  ).length;
  const pendingSync = opsRows.filter((w) => w.pending_sync_flag || w.planner_conflict_flag).length;

  const intakeTrend = buildDaySeries(filters.from, filters.to, intakeRows);
  const opsByStatus = countBy(opsRows, (w) => w.current_status);

  return (
    <ProtectedRoute requireRole="dispatcher">
      <DispatcherShell>
        <ReportsShell>
          <ReportFiltersBar
            filters={filters}
            setFilters={setFilters}
            setDays={setDays}
            show={{ client: true, trade: true, zone: false }}
          />

          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <KpiCard label="Intake — needs review" value={fmtInt(needsReview)} hint={`of ${fmtInt(intakeRows.length)} intakes`} icon={<Inbox className="h-4 w-4" />} />
            <KpiCard label="Duplicate suspected" value={fmtInt(duplicates)} hint={fmtPct(intakeRows.length ? duplicates / intakeRows.length : 0)} icon={<AlertTriangle className="h-4 w-4" />} />
            <KpiCard label="Unassigned jobs" value={fmtInt(unassigned)} hint="In selected window" icon={<ClipboardList className="h-4 w-4" />} />
            <KpiCard label="Pending sync / conflicts" value={fmtInt(pendingSync)} hint="Work orders with sync flag" icon={<RefreshCw className="h-4 w-4" />} />
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
            <KpiCard label="Converted" value={fmtInt(converted)} />
            <KpiCard label="Rejected" value={fmtInt(rejected)} />
            <KpiCard label="In flight" value={fmtInt(inFlight)} />
            <KpiCard label="Awaiting review" value={fmtInt(review)} />
          </div>

          <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-2">
            <ReportSection title="Intake volume" description="Daily intake records in range">
              <TrendLine data={intakeTrend} keys={["total"]} />
            </ReportSection>
            <ReportSection title="Work orders by status" description="Current status, in range">
              <BarBreakdown data={opsByStatus.slice(0, 10)} horizontal />
            </ReportSection>
          </div>

          {(intake.isLoading || ops.isLoading) && (
            <p className="mt-4 text-xs text-muted-foreground">Loading reports…</p>
          )}
        </ReportsShell>
      </DispatcherShell>
    </ProtectedRoute>
  );
}