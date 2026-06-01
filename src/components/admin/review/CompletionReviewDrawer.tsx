import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useWorkOrder } from "@/hooks/useWorkOrders";
import {
  extractFieldSubmission,
  useWorkOrderEvents,
} from "@/hooks/usePostCompletionQueue";
import { StatusBadge, PriorityBadge } from "@/components/admin/StatusBadge";
import { EvidenceReviewPanel } from "./EvidenceReviewPanel";
import { FollowUpActionBar } from "./FollowUpActionBar";
import { JobTimelinePanel } from "./JobTimelinePanel";
import { PushToExpensesAction } from "./PushToExpensesAction";
import { useWorkOrderExpenses } from "@/hooks/useWorkOrderExpenses";
import { AlertTriangle, Lock, ShieldCheck } from "lucide-react";

export function CompletionReviewDrawer({
  workOrderId,
  open,
  onOpenChange,
}: {
  workOrderId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { data, isLoading } = useWorkOrder(workOrderId);
  const { data: events = [] } = useWorkOrderEvents(workOrderId);
  const { data: expenses = [] } = useWorkOrderExpenses(workOrderId);
  const submission = extractFieldSubmission(events);
  const lead = data?.assignments.find((a) => a.assignment_role === "lead");
  const expensesPushed = !!data?.expenses_pushed_at;
  const expensesPending = expenses.length > 0 && !expensesPushed;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-2xl">
        <SheetHeader>
          <SheetTitle className="text-base">
            {data ? `Review · ${data.order_no}` : "Review"}
          </SheetTitle>
        </SheetHeader>

        {isLoading && (
          <div className="mt-6 text-sm text-muted-foreground">Loading job…</div>
        )}

        {data && (
          <div className="mt-4 space-y-5 pb-10 text-sm">
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge status={data.current_status} />
              <PriorityBadge priority={data.priority_level} />
              {data.field_lock_active && (
                <span className="inline-flex items-center gap-1 rounded-sm bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-amber-900">
                  <Lock className="h-3 w-3" /> Field-locked
                </span>
              )}
              {data.review_outcome && (
                <span className="rounded-sm bg-secondary px-1.5 py-0.5 text-[10px] font-semibold uppercase text-secondary-foreground">
                  Outcome: {data.review_outcome}
                </span>
              )}
            </div>

            <Section title="Engineer submission">
              {submission ? (
                <div className="space-y-2 text-xs">
                  <Row label="Outcome">
                    <span
                      className={
                        submission.outcome === "complete"
                          ? "rounded-sm bg-emerald-100 px-1.5 py-0.5 font-semibold uppercase text-emerald-900"
                          : "rounded-sm bg-amber-100 px-1.5 py-0.5 font-semibold uppercase text-amber-900"
                      }
                    >
                      {submission.outcome}
                    </span>
                  </Row>
                  <Row label="Submitted">
                    {new Date(submission.submitted_at).toLocaleString()}
                  </Row>
                  <Row label="By">
                    {lead?.engineer?.display_name ?? "—"}
                  </Row>
                  {submission.outcome === "incomplete" && (
                    <Row label="Reason">{submission.reason ?? "—"}</Row>
                  )}
                  {submission.notes && (
                    <Row label="Engineer notes" stack>
                      <p className="whitespace-pre-wrap rounded-sm bg-muted/40 p-2 text-xs">
                        {submission.notes}
                      </p>
                    </Row>
                  )}
                  {submission.advisory_notes && (
                    <Row label="Customer advisory" stack>
                      <p className="whitespace-pre-wrap rounded-sm border border-amber-200 bg-amber-50 p-2 text-xs text-amber-950">
                        {submission.advisory_notes}
                      </p>
                    </Row>
                  )}
                  <div className="flex items-center gap-1.5 pt-1 text-[11px] text-muted-foreground">
                    <ShieldCheck className="h-3 w-3" />
                    Engineer submission is immutable for accountability.
                  </div>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">
                  No field submission found yet for this job.
                </p>
              )}
            </Section>

            <Section title="Checklist results">
              {submission?.checklist && Object.keys(submission.checklist).length > 0 ? (
                <ul className="grid grid-cols-1 gap-1 text-xs sm:grid-cols-2">
                  {Object.entries(submission.checklist).map(([k, v]) => (
                    <li
                      key={k}
                      className="flex items-center justify-between rounded-sm border border-border bg-card px-2 py-1"
                    >
                      <span className="truncate text-foreground">{k}</span>
                      <span
                        className={
                          v
                            ? "text-[11px] font-semibold uppercase text-emerald-700"
                            : "text-[11px] font-semibold uppercase text-amber-700"
                        }
                      >
                        {v ? "Done" : "Missed"}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-muted-foreground">
                  No checklist data on this submission.
                </p>
              )}
            </Section>

            <Section title="Evidence">
              <EvidenceReviewPanel
                workOrderId={data.id}
                submission={submission}
              />
            </Section>

            <Section title="Expenses">
              <PushToExpensesAction
                workOrderId={data.id}
                pushedAt={data.expenses_pushed_at}
              />
            </Section>

            <Section title="Follow-up action">
              {expensesPending ? (
                <div className="mb-2 flex items-start gap-2 rounded-sm border border-amber-300 bg-amber-50 px-2 py-1.5 text-[11px] text-amber-900">
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  <span>
                    Acknowledge and push the engineer's expenses above before closing this job.
                  </span>
                </div>
              ) : null}
              <FollowUpActionBar
                workOrderId={data.id}
                onDone={() => onOpenChange(false)}
                blockClose={expensesPending}
              />
            </Section>

            <Section title="Timeline">
              <JobTimelinePanel workOrderId={data.id} />
            </Section>

            {data.admin_notes && (
              <Section title="Admin notes (audit)">
                <p className="whitespace-pre-wrap text-xs text-foreground">
                  {data.admin_notes}
                </p>
              </Section>
            )}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        {title}
      </h3>
      <div className="space-y-2 rounded-md border border-border bg-card p-3">
        {children}
      </div>
    </section>
  );
}

function Row({
  label,
  children,
  stack,
}: {
  label: string;
  children: React.ReactNode;
  stack?: boolean;
}) {
  if (stack) {
    return (
      <div>
        <div className="text-[11px] uppercase tracking-wider text-muted-foreground">
          {label}
        </div>
        <div className="mt-1">{children}</div>
      </div>
    );
  }
  return (
    <div className="grid grid-cols-[120px_1fr] items-center gap-2">
      <div className="text-[11px] uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div>{children}</div>
    </div>
  );
}