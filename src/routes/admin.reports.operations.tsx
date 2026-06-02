import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { DispatcherShell } from "@/components/DispatcherShell";
import { ReportsShell } from "@/components/admin/reports/ReportsShell";
import { KpiCard, ReportSection } from "@/components/admin/reports/KpiCard";
import { BarBreakdown, TrendLine } from "@/components/admin/reports/Charts";
import { ReportFiltersBar } from "@/components/admin/reports/ReportFilters";
import { useOperationsReports, useReportFilters } from "@/hooks/useReports";
import { buildDaySeries, countBy, fmtInt } from "@/lib/reportFormatters";

export const Route = createFileRoute("/admin/reports/operations")({
  head: () => ({ meta: [{ title: "Operations report · OCS" }] }),
  component: OperationsReportPage,
});

const OPEN_STATUSES = new Set([
  "ingested",
  "parsing_in_progress",
  "parsed_ready",
  "categorized",
  "ready_for_dispatch",
  "scheduled_in_sheet",
  "assigned",
  "accepted",
  "en_route",
  "on_site",
  "field_in_progress",
  "field_submitted_complete",
  "field_submitted_incomplete",
  "dispatcher_review",
  "follow_up_required",
]);

function OperationsReportPage() {
  const { filters, setFilters, setDays } = useReportFilters(30);
  const q = useOperationsReports(filters);
  const rows = q.data ?? [];

  const zones = useMemo(
    () => Array.from(new Set(rows.map((r) => r.postcode_zone).filter(Boolean) as string[])).sort(),
    [rows],
  );

  const unassigned = rows.filter((r) => (r.assignments?.length ?? 0) === 0 && OPEN_STATUSES.has(r.current_status)).length;
  const assigned = rows.filter((r) => (r.assignments?.length ?? 0) > 0 && OPEN_STATUSES.has(r.current_status)).length;
  const aging = rows.filter((r) => {
    if (!OPEN_STATUSES.has(r.current_status)) return false;
    const age = Date.now() - new Date(r.created_at).getTime();
    return age > 7 * 86_400_000;
  }).length;
  const closed = rows.filter((r) => r.current_status === "closed").length;

  const byStatus = countBy(rows, (r) => r.current_status);
  const byZone = countBy(rows, (r) => r.postcode_zone);
  const byClient = countBy(rows, (r) => r.client?.client_name ?? null);
  const trend = buildDaySeries(filters.from, filters.to, rows);

  return (
    <ProtectedRoute requireRole="dispatcher">
      <DispatcherShell>
        <ReportsShell>
          <ReportFiltersBar
            filters={filters}
            setFilters={setFilters}
            setDays={setDays}
            show={{ client: true, trade: true, zone: true }}
            zones={zones}
          />

          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <KpiCard label="Unassigned" value={fmtInt(unassigned)} hint="Open, no engineer" />
            <KpiCard label="Assigned / in flight" value={fmtInt(assigned)} hint="Open with engineers" />
            <KpiCard label="Aging > 7 days" value={fmtInt(aging)} hint="Open longer than 7d" />
            <KpiCard label="Closed in range" value={fmtInt(closed)} />
          </div>

          <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-2">
            <ReportSection title="Work orders by status">
              <BarBreakdown data={byStatus.slice(0, 12)} horizontal />
            </ReportSection>
            <ReportSection title="By client">
              <BarBreakdown data={byClient.slice(0, 10)} horizontal />
            </ReportSection>
            <ReportSection title="By postcode zone">
              <BarBreakdown data={byZone.slice(0, 12)} horizontal />
            </ReportSection>
            <ReportSection title="Daily new work orders">
              <TrendLine data={trend} keys={["total"]} />
            </ReportSection>
            <ReportSection title="Top clients (table)">
              <table className="w-full text-xs">
                <thead className="border-b border-border text-muted-foreground">
                  <tr>
                    <th className="py-1 text-left">Client</th>
                    <th className="py-1 text-right">Jobs</th>
                  </tr>
                </thead>
                <tbody>
                  {byClient.slice(0, 10).map((r) => (
                    <tr key={r.name} className="border-b border-border/50">
                      <td className="py-1.5">{r.name}</td>
                      <td className="py-1.5 text-right">{r.value}</td>
                    </tr>
                  ))}
                  {byClient.length === 0 && (
                    <tr><td colSpan={2} className="py-4 text-center text-muted-foreground">No data</td></tr>
                  )}
                </tbody>
              </table>
            </ReportSection>
          </div>
        </ReportsShell>
      </DispatcherShell>
    </ProtectedRoute>
  );
}