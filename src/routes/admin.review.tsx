import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { DispatcherShell } from "@/components/DispatcherShell";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { CompletionReviewDrawer } from "@/components/admin/review/CompletionReviewDrawer";
import { usePostCompletionQueue } from "@/hooks/usePostCompletionQueue";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { Button } from "@/components/ui/button";
import { ClipboardCheck, AlertTriangle, CheckCircle2, Trash2 } from "lucide-react";
import { DeleteWorkOrderDialog } from "@/components/admin/DeleteWorkOrderDialog";

export const Route = createFileRoute("/admin/review")({
  head: () => ({ meta: [{ title: "Review Queue · OCS" }] }),
  component: ReviewPage,
});

function ReviewPage() {
  const [selected, setSelected] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; orderNo: string | null } | null>(null);
  const [filter, setFilter] = useState<"all" | "complete" | "incomplete" | "follow_up">("all");
  const { data, isLoading, error } = usePostCompletionQueue();

  const filtered = useMemo(() => {
    if (!data) return [];
    if (filter === "all") return data;
    if (filter === "complete")
      return data.filter((w) => w.current_status === "field_submitted_complete");
    if (filter === "incomplete")
      return data.filter((w) => w.current_status === "field_submitted_incomplete");
    return data.filter(
      (w) =>
        w.current_status === "follow_up_required" ||
        w.current_status === "dispatcher_review",
    );
  }, [data, filter]);

  const counts = useMemo(() => {
    const c = { complete: 0, incomplete: 0, follow_up: 0 };
    (data ?? []).forEach((w) => {
      if (w.current_status === "field_submitted_complete") c.complete += 1;
      else if (w.current_status === "field_submitted_incomplete") c.incomplete += 1;
      else c.follow_up += 1;
    });
    return c;
  }, [data]);

  return (
    <ProtectedRoute requireRole="dispatcher">
      <DispatcherShell>
        <div className="mx-auto max-w-7xl">
          <AdminPageHeader
            title="Post-completion review"
            description="Engineer-submitted jobs awaiting dispatcher follow-up: close, revisit, quote, or escalate."
          />

          <div className="mb-3 flex flex-wrap items-center gap-2">
            <FilterChip
              active={filter === "all"}
              onClick={() => setFilter("all")}
              icon={ClipboardCheck}
              label={`All (${data?.length ?? 0})`}
            />
            <FilterChip
              active={filter === "complete"}
              onClick={() => setFilter("complete")}
              icon={CheckCircle2}
              label={`Complete (${counts.complete})`}
              tone="success"
            />
            <FilterChip
              active={filter === "incomplete"}
              onClick={() => setFilter("incomplete")}
              icon={AlertTriangle}
              label={`Incomplete (${counts.incomplete})`}
              tone="warn"
            />
            <FilterChip
              active={filter === "follow_up"}
              onClick={() => setFilter("follow_up")}
              icon={ClipboardCheck}
              label={`Follow-up (${counts.follow_up})`}
            />
          </div>

          {isLoading ? (
            <div className="h-32 animate-pulse rounded-md bg-muted/40" />
          ) : error ? (
            <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-900">
              Couldn't load review queue.
            </div>
          ) : filtered.length === 0 ? (
            <div className="rounded-md border border-dashed border-border bg-card px-4 py-12 text-center text-sm text-muted-foreground">
              No jobs in this view.
            </div>
          ) : (
            <ul className="space-y-2">
              {filtered.map((w) => {
                const lead = w.assignments.find(
                  (a) => a.assignment_role === "lead",
                );
                const isIncomplete = w.current_status === "field_submitted_incomplete";
                return (
                  <li
                    key={w.id}
                    className={`rounded-md border bg-card p-3 ${
                      isIncomplete ? "border-amber-300" : "border-border"
                    }`}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-foreground">
                            {w.order_no}
                          </span>
                          <StatusBadge status={w.current_status} />
                          {w.review_outcome && (
                            <span className="rounded-sm bg-secondary px-1.5 py-0.5 text-[10px] font-semibold uppercase text-secondary-foreground">
                              {w.review_outcome}
                            </span>
                          )}
                        </div>
                        <div className="mt-1 text-sm text-foreground">
                          {w.job_summary || "—"}
                        </div>
                        <div className="mt-1 text-xs text-muted-foreground">
                          Lead: {lead?.engineer?.display_name ?? "Unassigned"} ·
                          Diary: {w.diary_date ?? "—"} ·
                          {isIncomplete
                            ? ` Reason: ${w.current_outcome_reason ?? "—"} ·`
                            : ""}
                          {" "}Updated: {new Date(w.updated_at).toLocaleString()}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          variant={isIncomplete ? "default" : "outline"}
                          onClick={() => setSelected(w.id)}
                        >
                          Review
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                          onClick={() => setDeleteTarget({ id: w.id, orderNo: w.order_no })}
                          aria-label={`Delete ${w.order_no}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
        <CompletionReviewDrawer
          workOrderId={selected}
          open={!!selected}
          onOpenChange={(o) => !o && setSelected(null)}
        />
        <DeleteWorkOrderDialog
          open={!!deleteTarget}
          onOpenChange={(o) => !o && setDeleteTarget(null)}
          workOrderId={deleteTarget?.id ?? null}
          orderNo={deleteTarget?.orderNo ?? null}
        />
      </DispatcherShell>
    </ProtectedRoute>
  );
}

function FilterChip({
  active,
  onClick,
  icon: Icon,
  label,
  tone,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  tone?: "success" | "warn";
}) {
  const toneClass =
    tone === "success"
      ? "data-[active=true]:bg-emerald-600 data-[active=true]:text-white data-[active=true]:border-emerald-600"
      : tone === "warn"
        ? "data-[active=true]:bg-amber-500 data-[active=true]:text-white data-[active=true]:border-amber-500"
        : "data-[active=true]:bg-primary data-[active=true]:text-primary-foreground data-[active=true]:border-primary";
  return (
    <button
      data-active={active}
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-foreground hover:bg-muted ${toneClass}`}
    >
      <Icon className="h-3.5 w-3.5" />
      {label}
    </button>
  );
}