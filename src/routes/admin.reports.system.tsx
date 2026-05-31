import { createFileRoute } from "@tanstack/react-router";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { DispatcherShell } from "@/components/DispatcherShell";
import { ReportsShell } from "@/components/admin/reports/ReportsShell";
import { KpiCard, ReportSection, EmptyState } from "@/components/admin/reports/KpiCard";
import { BarBreakdown, StackedBar } from "@/components/admin/reports/Charts";
import { ReportFiltersBar } from "@/components/admin/reports/ReportFilters";
import { useReportFilters, useSystemReports } from "@/hooks/useReports";
import { buildDaySeries, countBy, fmtDate, fmtInt } from "@/lib/reportFormatters";

export const Route = createFileRoute("/admin/reports/system")({
  head: () => ({ meta: [{ title: "System health report · OCS" }] }),
  component: SystemReportPage,
});

function SystemReportPage() {
  const { filters, setFilters, setDays } = useReportFilters(30);
  const q = useSystemReports(filters);
  const { workOrders = [], sheetLog = [], parsingReviews = [] } = q.data ?? {};

  const pendingSync = workOrders.filter((w) => w.pending_sync_flag).length;
  const conflicts = workOrders.filter((w) => w.planner_conflict_flag).length;
  const locked = workOrders.filter((w) => w.field_lock_active).length;
  const failures = sheetLog.filter((s) => s.sync_status === "error" || s.sync_status === "failed").length;

  const syncTrend = buildDaySeries(filters.from, filters.to, sheetLog, (s) =>
    s.sync_status === "error" || s.sync_status === "failed" ? "failed" : "ok",
  );
  const reviewTrend = buildDaySeries(filters.from, filters.to, parsingReviews);
  const byIssue = countBy(parsingReviews, (r) => r.issue_type);

  const openReviews = parsingReviews.filter((r) => r.review_status === "open").length;

  return (
    <ProtectedRoute requireRole="dispatcher">
      <DispatcherShell>
        <ReportsShell>
          <ReportFiltersBar filters={filters} setFilters={setFilters} setDays={setDays} show={{ client: false, trade: false, zone: false }} />

          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <KpiCard label="Pending sync" value={fmtInt(pendingSync)} hint="Work orders with pending updates" />
            <KpiCard label="Planner conflicts" value={fmtInt(conflicts)} />
            <KpiCard label="Field-locked jobs" value={fmtInt(locked)} hint="Active lead engineer locks" />
            <KpiCard label="Sync failures (range)" value={fmtInt(failures)} />
          </div>

          <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-2">
            <ReportSection title="Sheet sync activity">
              <StackedBar data={syncTrend} keys={["ok", "failed"]} />
            </ReportSection>
            <ReportSection title="Parsing reviews opened">
              <StackedBar data={reviewTrend} keys={["total"]} />
            </ReportSection>
            <ReportSection title="Review issue types">
              <BarBreakdown data={byIssue} horizontal />
            </ReportSection>
            <ReportSection title={`Open parsing reviews · ${openReviews}`}>
              {parsingReviews.length === 0 ? (
                <EmptyState />
              ) : (
                <table className="w-full text-xs">
                  <thead className="border-b border-border text-muted-foreground">
                    <tr>
                      <th className="py-1 text-left">Opened</th>
                      <th className="py-1 text-left">Issue</th>
                      <th className="py-1 text-left">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {parsingReviews.slice(0, 12).map((r) => (
                      <tr key={r.id} className="border-b border-border/50">
                        <td className="py-1.5">{fmtDate(r.created_at)}</td>
                        <td className="py-1.5">{r.issue_type}</td>
                        <td className="py-1.5">{r.review_status}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </ReportSection>
          </div>

          <div className="mt-4">
            <ReportSection title="Recent sync failures">
              {sheetLog.filter((s) => s.sync_status === "error" || s.sync_status === "failed").length === 0 ? (
                <EmptyState label="No sync failures in range." />
              ) : (
                <table className="w-full text-xs">
                  <thead className="border-b border-border text-muted-foreground">
                    <tr>
                      <th className="py-1 text-left">When</th>
                      <th className="py-1 text-left">Direction</th>
                      <th className="py-1 text-left">Sheet</th>
                      <th className="py-1 text-left">Error</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sheetLog
                      .filter((s) => s.sync_status === "error" || s.sync_status === "failed")
                      .slice(0, 15)
                      .map((s) => (
                        <tr key={s.id} className="border-b border-border/50">
                          <td className="py-1.5">{fmtDate(s.created_at)}</td>
                          <td className="py-1.5">{s.sync_direction}</td>
                          <td className="py-1.5">{s.sheet_name ?? "—"}</td>
                          <td className="py-1.5 text-muted-foreground">{s.error_message ?? "—"}</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              )}
            </ReportSection>
          </div>
        </ReportsShell>
      </DispatcherShell>
    </ProtectedRoute>
  );
}