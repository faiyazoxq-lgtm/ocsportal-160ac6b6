import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { AlertTriangle } from "lucide-react";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { DispatcherShell } from "@/components/DispatcherShell";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { WorkOrderTable } from "@/components/admin/WorkOrderTable";
import { WorkOrderDetail } from "@/components/admin/WorkOrderDetail";
import { useWorkOrders } from "@/hooks/useWorkOrders";
import { useParsingReviews } from "@/hooks/useParsingReviews";
import { useResolveParsingReview } from "@/hooks/useAssignments";
import { ATTENTION_STATUSES } from "@/types/workOrders";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/admin/attention")({
  head: () => ({ meta: [{ title: "Admin Attention · OCS" }] }),
  component: AttentionPage,
});

function AttentionPage() {
  const [selected, setSelected] = useState<string | null>(null);
  const wo = useWorkOrders(ATTENTION_STATUSES, { key: "attention" });
  const reviews = useParsingReviews();
  const resolve = useResolveParsingReview();

  return (
    <ProtectedRoute requireRole="dispatcher">
      <DispatcherShell>
        <div className="mx-auto max-w-7xl space-y-8">
          <AdminPageHeader
            title="Admin Attention"
            description="Work orders and parsing reviews flagged for manual review."
          />

          <section>
            <h2 className="mb-2 text-sm font-semibold text-foreground">
              Parsing reviews
            </h2>
            {reviews.isLoading ? (
              <div className="h-24 animate-pulse rounded-md bg-muted/40" />
            ) : reviews.error ? (
              <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-900">
                Couldn't load parsing reviews.
              </div>
            ) : !reviews.data || reviews.data.length === 0 ? (
              <div className="rounded-md border border-dashed border-border bg-card px-4 py-8 text-center text-sm text-muted-foreground">
                No open parsing reviews.
              </div>
            ) : (
              <ul className="space-y-2">
                {reviews.data.map((r) => (
                  <li
                    key={r.id}
                    className="flex items-start justify-between gap-3 rounded-md border border-amber-200 bg-amber-50 p-3"
                  >
                    <div className="flex items-start gap-2">
                      <AlertTriangle className="mt-0.5 h-4 w-4 text-amber-700" />
                      <div>
                        <div className="text-sm font-medium text-amber-900">
                          {r.issue_type}
                        </div>
                        {r.issue_summary && (
                          <div className="text-xs text-amber-900/80">
                            {r.issue_summary}
                          </div>
                        )}
                        {Array.isArray(r.missing_fields_json) &&
                          r.missing_fields_json.length > 0 && (
                            <div className="mt-1 flex flex-wrap gap-1">
                              {r.missing_fields_json.map((f) => (
                                <span
                                  key={f}
                                  className="rounded-sm bg-amber-200 px-1.5 py-0.5 text-[10px] font-medium uppercase text-amber-900"
                                >
                                  missing: {f}
                                </span>
                              ))}
                            </div>
                          )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setSelected(r.work_order_id)}
                      >
                        Open
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={resolve.isPending}
                        onClick={() =>
                          resolve.mutate({
                            review_id: r.id,
                            work_order_id: r.work_order_id,
                          })
                        }
                      >
                        {resolve.isPending ? "Saving…" : "Mark reviewed"}
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section>
            <h2 className="mb-2 text-sm font-semibold text-foreground">
              Work orders needing attention
            </h2>
            <WorkOrderTable
              rows={wo.data}
              isLoading={wo.isLoading}
              error={wo.error}
              onRowClick={setSelected}
              emptyMessage="Nothing flagged for admin attention."
            />
          </section>
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