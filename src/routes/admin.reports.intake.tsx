import { createFileRoute } from "@tanstack/react-router";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { DispatcherShell } from "@/components/DispatcherShell";
import { ReportsShell } from "@/components/admin/reports/ReportsShell";
import { KpiCard, ReportSection } from "@/components/admin/reports/KpiCard";
import { TrendLine, BarBreakdown, StackedBar } from "@/components/admin/reports/Charts";
import { ReportFiltersBar } from "@/components/admin/reports/ReportFilters";
import { useIntakeReports, useReportFilters } from "@/hooks/useReports";
import { buildDaySeries, countBy, fmtDuration, fmtInt, fmtPct } from "@/lib/reportFormatters";

export const Route = createFileRoute("/admin/reports/intake")({
  head: () => ({ meta: [{ title: "Intake report · OCS" }] }),
  component: IntakeReportPage,
});

function IntakeReportPage() {
  const { filters, setFilters, setDays } = useReportFilters(30);
  const q = useIntakeReports(filters);
  const rows = q.data ?? [];

  const total = rows.length;
  const needsReview = rows.filter((r) => r.parse_status === "needs_review").length;
  const dup = rows.filter((r) => {
    const a = Array.isArray(r.duplicate_candidates_json) ? r.duplicate_candidates_json : [];
    return a.length > 0 || r.parse_status === "duplicate_suspected";
  }).length;
  const converted = rows.filter((r) => r.parse_status === "converted");
  const rejected = rows.filter((r) => r.parse_status === "rejected").length;

  const convertedTimes = converted
    .map((r) => (r.reviewed_at ? new Date(r.reviewed_at).getTime() - new Date(r.created_at).getTime() : null))
    .filter((n): n is number => n != null && n > 0);
  const avgConv = convertedTimes.length
    ? convertedTimes.reduce((a, b) => a + b, 0) / convertedTimes.length
    : null;

  const trend = buildDaySeries(filters.from, filters.to, rows, (r) =>
    (r as { parse_status: string }).parse_status === "converted"
      ? "converted"
      : (r as { parse_status: string }).parse_status === "rejected"
        ? "rejected"
        : "open",
  );

  const bySource = countBy(rows, (r) => r.source_type);
  const confidenceBuckets = (() => {
    const buckets = [
      { name: "<50%", value: 0 },
      { name: "50–69%", value: 0 },
      { name: "70–84%", value: 0 },
      { name: "85–100%", value: 0 },
    ];
    for (const r of rows) {
      const c = r.parse_confidence ?? 0;
      const i = c < 0.5 ? 0 : c < 0.7 ? 1 : c < 0.85 ? 2 : 3;
      buckets[i].value += 1;
    }
    return buckets;
  })();

  return (
    <ProtectedRoute requireRole="dispatcher">
      <DispatcherShell>
        <ReportsShell>
          <ReportFiltersBar filters={filters} setFilters={setFilters} setDays={setDays} show={{ client: false, trade: false, zone: false }} />

          <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
            <KpiCard label="Total intakes" value={fmtInt(total)} />
            <KpiCard label="Needs review" value={fmtInt(needsReview)} hint={fmtPct(total ? needsReview / total : 0)} />
            <KpiCard label="Duplicate suspected" value={fmtInt(dup)} hint={fmtPct(total ? dup / total : 0)} />
            <KpiCard label="Converted" value={fmtInt(converted.length)} hint={`Rejected: ${fmtInt(rejected)}`} />
            <KpiCard label="Avg intake → convert" value={fmtDuration(avgConv)} hint={`${converted.length} converted`} />
          </div>

          <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-2">
            <ReportSection title="Daily intake outcomes">
              <StackedBar data={trend} keys={["open", "converted", "rejected"]} />
            </ReportSection>
            <ReportSection title="Parsing confidence distribution">
              <BarBreakdown data={confidenceBuckets} />
            </ReportSection>
            <ReportSection title="By source channel">
              <BarBreakdown data={bySource} horizontal />
            </ReportSection>
            <ReportSection title="Intake volume trend">
              <TrendLine data={trend} keys={["total"]} />
            </ReportSection>
          </div>

          {q.isLoading && <p className="mt-4 text-xs text-muted-foreground">Loading…</p>}
        </ReportsShell>
      </DispatcherShell>
    </ProtectedRoute>
  );
}