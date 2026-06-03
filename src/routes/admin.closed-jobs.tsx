import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { CheckCircle2, Search } from "lucide-react";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { DispatcherShell } from "@/components/DispatcherShell";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { WorkOrderDetail } from "@/components/admin/WorkOrderDetail";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { useClosedJobs } from "@/hooks/useDispatcherOpsViews";

export const Route = createFileRoute("/admin/closed-jobs")({
  head: () => ({ meta: [{ title: "Closed jobs · OCS" }] }),
  component: ClosedJobsPage,
});

function ClosedJobsPage() {
  const closed = useClosedJobs(200);
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<string | null>(null);

  const rows = useMemo(() => {
    const list = closed.data ?? [];
    const needle = q.trim().toLowerCase();
    if (!needle) return list;
    return list.filter((w) => {
      const haystack = [
        w.order_no,
        w.job_summary,
        w.client?.client_name,
        w.postcode,
        w.address_line_1,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(needle);
    });
  }, [closed.data, q]);

  return (
    <ProtectedRoute requireRole="dispatcher">
      <DispatcherShell>
        <div className="mx-auto max-w-7xl space-y-4">
          <AdminPageHeader
            title="Closed jobs"
            description="All jobs marked as closed by the dispatcher review."
          />

          <div className="flex items-center gap-2">
            <div className="relative flex-1 max-w-md">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search by order no, customer, postcode…"
                className="w-full rounded-sm border border-input bg-background py-1.5 pl-8 pr-2 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/30"
              />
            </div>
            <span className="text-xs text-muted-foreground">
              {closed.isLoading ? "Loading…" : `${rows.length} job${rows.length === 1 ? "" : "s"}`}
            </span>
          </div>

          {closed.isLoading ? (
            <div className="h-40 animate-pulse rounded-md bg-muted/40" />
          ) : rows.length === 0 ? (
            <div className="rounded-md border border-dashed border-border bg-card px-4 py-12 text-center text-sm text-muted-foreground">
              <CheckCircle2 className="mx-auto mb-2 h-6 w-6 text-muted-foreground/60" />
              {q ? "No closed jobs match this search." : "No closed jobs yet."}
            </div>
          ) : (
            <div className="overflow-hidden rounded-md border border-border bg-card">
              <ul className="divide-y divide-border">
                {rows.map((w) => {
                  const lead = w.assignments.find(
                    (a) => a.assignment_role === "lead" && a.assignment_status !== "removed",
                  );
                  return (
                    <li key={w.id}>
                      <button
                        onClick={() => setSelected(w.id)}
                        className="flex w-full flex-col gap-1 px-3 py-2.5 text-left text-xs hover:bg-accent/30 sm:flex-row sm:items-center sm:gap-3"
                      >
                        <span className="min-w-[110px] text-[13px] font-semibold text-foreground">
                          {w.order_no}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[13px] font-semibold text-foreground">
                            {w.job_summary || "—"}
                          </span>
                          <span className="block truncate text-[13px] font-medium text-foreground/75">
                            {w.client?.client_name || "—"}
                            {w.postcode ? ` · ${w.postcode}` : ""}
                          </span>
                        </span>
                        <span className="min-w-[140px] truncate text-[13px] font-medium text-foreground/75">
                          {lead?.engineer?.display_name ?? "Unassigned"}
                        </span>
                        <span className="min-w-[110px] text-[13px] font-medium text-foreground/75">
                          Closed {new Date(w.updated_at).toLocaleDateString()}
                        </span>
                        <StatusBadge status={w.current_status} />
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          <div className="text-xs text-muted-foreground">
            <Link to="/admin" className="text-primary hover:underline">
              ← Back to operations overview
            </Link>
          </div>
        </div>

        <WorkOrderDetail
          workOrderId={selected}
          open={!!selected}
          onOpenChange={(o) => !o && setSelected(null)}
        />
      </DispatcherShell>
    </ProtectedRoute>
  );
}