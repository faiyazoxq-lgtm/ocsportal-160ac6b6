import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { DispatcherShell } from "@/components/DispatcherShell";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { WorkOrderDetail } from "@/components/admin/WorkOrderDetail";
import { useWorkOrders } from "@/hooks/useWorkOrders";
import { REVIEW_STATUSES } from "@/types/workOrders";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/admin/review")({
  head: () => ({ meta: [{ title: "Review Queue · OCS" }] }),
  component: ReviewPage,
});

function ReviewPage() {
  const [selected, setSelected] = useState<string | null>(null);
  const { data, isLoading, error } = useWorkOrders(REVIEW_STATUSES, {
    key: "review",
  });

  return (
    <ProtectedRoute requireRole="dispatcher">
      <DispatcherShell>
        <div className="mx-auto max-w-7xl">
          <AdminPageHeader
            title="Review Queue"
            description="Completed and incomplete jobs awaiting dispatcher sign-off."
          />

          {isLoading ? (
            <div className="h-32 animate-pulse rounded-md bg-muted/40" />
          ) : error ? (
            <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-900">
              Couldn't load review queue.
            </div>
          ) : !data || data.length === 0 ? (
            <div className="rounded-md border border-dashed border-border bg-card px-4 py-12 text-center text-sm text-muted-foreground">
              No jobs awaiting review.
            </div>
          ) : (
            <ul className="space-y-2">
              {data.map((w) => {
                const lead = w.assignments.find(
                  (a) => a.assignment_role === "lead",
                );
                return (
                  <li
                    key={w.id}
                    className="rounded-md border border-border bg-card p-3"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-foreground">
                            {w.order_no}
                          </span>
                          <StatusBadge status={w.current_status} />
                        </div>
                        <div className="mt-1 text-sm text-foreground">
                          {w.job_summary || "—"}
                        </div>
                        <div className="mt-1 text-xs text-muted-foreground">
                          Lead: {lead?.engineer?.display_name ?? "Unassigned"} ·
                          Diary: {w.diary_date ?? "—"} ·
                          Outcome reason: {w.current_outcome_reason ?? "—"} ·
                          Review: {w.review_outcome ?? "pending"}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setSelected(w.id)}
                        >
                          Open
                        </Button>
                        <Button size="sm" variant="outline" disabled>
                          Set outcome
                        </Button>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
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