import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { DispatcherShell } from "@/components/DispatcherShell";
import { ReportsShell } from "@/components/admin/reports/ReportsShell";
import { KpiCard, ReportSection, EmptyState } from "@/components/admin/reports/KpiCard";
import { BarBreakdown } from "@/components/admin/reports/Charts";
import { ReportFiltersBar } from "@/components/admin/reports/ReportFilters";
import { useEngineerReports, useReportFilters } from "@/hooks/useReports";
import { countBy, fmtDuration, fmtInt } from "@/lib/reportFormatters";

export const Route = createFileRoute("/admin/reports/engineers")({
  head: () => ({ meta: [{ title: "Engineer report · OCS" }] }),
  component: EngineerReportPage,
});

function EngineerReportPage() {
  const { filters, setFilters, setDays } = useReportFilters(30);
  const q = useEngineerReports(filters);
  const { engineers = [], assignments = [], workOrders = [] } = q.data ?? {};

  const woById = useMemo(() => new Map(workOrders.map((w) => [w.id, w])), [workOrders]);

  const perEngineer = useMemo(() => {
    return engineers
      .map((e) => {
        const mine = assignments.filter((a) => a.engineer_id === e.id);
        const lead = mine.filter((a) => a.assignment_role === "lead").length;
        const support = mine.filter((a) => a.assignment_role === "support").length;
        const completedWos = mine.filter((a) => {
          const w = woById.get(a.work_order_id);
          return w && (w.current_status === "closed" || w.current_status === "field_submitted_complete");
        });
        const turnaround = completedWos
          .map((a) => {
            const w = woById.get(a.work_order_id);
            if (!w) return null;
            return new Date(w.updated_at).getTime() - new Date(w.created_at).getTime();
          })
          .filter((n): n is number => n != null && n > 0);
        const avg = turnaround.length ? turnaround.reduce((a, b) => a + b, 0) / turnaround.length : null;
        return {
          id: e.id,
          name: e.display_name,
          trade: "—",
          active: e.active_status,
          assigned: mine.length,
          lead,
          support,
          completed: completedWos.length,
          avgTurnaround: avg,
        };
      })
      .sort((a, b) => b.assigned - a.assigned);
  }, [engineers, assignments, woById]);

  const incomplete = workOrders.filter((w) => w.current_outcome_reason);
  const incompleteBy = countBy(incomplete, (w) => w.current_outcome_reason);

  const totalAssigned = assignments.length;
  const totalLead = assignments.filter((a) => a.assignment_role === "lead").length;
  const totalSupport = assignments.filter((a) => a.assignment_role === "support").length;
  const totalCompleted = perEngineer.reduce((a, b) => a + b.completed, 0);

  return (
    <ProtectedRoute requireRole="dispatcher">
      <DispatcherShell>
        <ReportsShell>
          <ReportFiltersBar filters={filters} setFilters={setFilters} setDays={setDays} show={{ engineer: true, client: false, trade: true, zone: false }} />

          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <KpiCard label="Assignments made" value={fmtInt(totalAssigned)} />
            <KpiCard label="Lead vs support" value={`${fmtInt(totalLead)} / ${fmtInt(totalSupport)}`} hint="lead / support" />
            <KpiCard label="Completed jobs" value={fmtInt(totalCompleted)} />
            <KpiCard label="Active engineers" value={fmtInt(engineers.filter((e) => e.active_status).length)} />
          </div>

          <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-2">
            <ReportSection title="Incomplete outcomes by reason">
              <BarBreakdown data={incompleteBy} horizontal />
            </ReportSection>
            <ReportSection title="Engineer workload (top by assignments)">
              <BarBreakdown data={perEngineer.slice(0, 10).map((e) => ({ name: e.name, value: e.assigned }))} horizontal />
            </ReportSection>
          </div>

          <div className="mt-4">
            <ReportSection title="Engineer workload table">
              {perEngineer.length === 0 ? (
                <EmptyState />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead className="border-b border-border text-muted-foreground">
                      <tr>
                        <th className="py-1 text-left">Engineer</th>
                        <th className="py-1 text-left">Trade</th>
                        <th className="py-1 text-right">Assigned</th>
                        <th className="py-1 text-right">Lead</th>
                        <th className="py-1 text-right">Support</th>
                        <th className="py-1 text-right">Completed</th>
                        <th className="py-1 text-right">Avg turnaround</th>
                      </tr>
                    </thead>
                    <tbody>
                      {perEngineer.map((e) => (
                        <tr key={e.id} className="border-b border-border/50">
                          <td className="py-1.5">
                            {e.name}{" "}
                            {!e.active && <span className="ml-1 text-[10px] text-muted-foreground">(inactive)</span>}
                          </td>
                          <td className="py-1.5 capitalize">{e.trade}</td>
                          <td className="py-1.5 text-right">{e.assigned}</td>
                          <td className="py-1.5 text-right">{e.lead}</td>
                          <td className="py-1.5 text-right">{e.support}</td>
                          <td className="py-1.5 text-right">{e.completed}</td>
                          <td className="py-1.5 text-right">{fmtDuration(e.avgTurnaround)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </ReportSection>
          </div>
        </ReportsShell>
      </DispatcherShell>
    </ProtectedRoute>
  );
}