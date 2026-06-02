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
import {
  AlertTriangle,
  Lock,
  ShieldCheck,
  CheckCircle2,
  ClipboardList,
  Image as ImageIcon,
  Receipt,
  Gavel,
  RotateCcw,
} from "lucide-react";

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
  const isReturned =
    data?.current_status === "follow_up_required" ||
    data?.current_status === "admin_attention";
  const reviewState: "returned" | "awaiting_expenses" | "ready" | "needs_submission" = !submission
    ? "needs_submission"
    : isReturned
      ? "returned"
      : expensesPending
        ? "awaiting_expenses"
        : "ready";

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
            <ReviewStatusBanner state={reviewState} />

            <Section title="Job summary" icon={ClipboardList} step={1}>
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
            </Section>

            <Section title="Engineer submission" icon={ShieldCheck} step={2}>
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

            <Section title="Checklist results" icon={ClipboardList} step={3}>
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

            <Section title="Evidence & media" icon={ImageIcon} step={4}>
              <EvidenceReviewPanel
                workOrderId={data.id}
                submission={submission}
              />
            </Section>

            <Section
              title="Expenses"
              icon={Receipt}
              step={5}
              tone={expensesPending ? "warn" : expensesPushed ? "ok" : undefined}
              statusLabel={
                expenses.length === 0
                  ? "None recorded"
                  : expensesPushed
                    ? "Pushed to ledger"
                    : "Awaiting acknowledgement"
              }
            >
              {expensesPending ? (
                <div className="mb-2 flex items-start gap-2 rounded-sm border border-amber-300 bg-amber-50 px-2 py-1.5 text-[11px] text-amber-900">
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  <span>
                    Review the engineer's expenses, then acknowledge & push to the ledger.
                    The job cannot be closed until this is done.
                  </span>
                </div>
              ) : null}
              <PushToExpensesAction
                workOrderId={data.id}
                pushedAt={data.expenses_pushed_at}
              />
            </Section>

            <Section title="Timeline" icon={RotateCcw}>
              <JobTimelinePanel workOrderId={data.id} />
            </Section>

            {data.admin_notes && (
              <Section title="Admin notes (audit)" icon={ClipboardList}>
                <p className="whitespace-pre-wrap text-xs text-foreground">
                  {data.admin_notes}
                </p>
              </Section>
            )}

            {/* Completion decision is visually separated as the final action. */}
            <section className="sticky bottom-0 -mx-6 border-t-2 border-primary/30 bg-background/95 px-6 pb-2 pt-4 backdrop-blur">
              <div className="mb-2 flex items-center justify-between">
                <h3 className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-foreground">
                  <Gavel className="h-3.5 w-3.5 text-primary" /> Completion decision
                </h3>
                <span
                  className={`rounded-sm px-1.5 py-0.5 text-[10px] font-semibold uppercase ${
                    reviewState === "ready"
                      ? "bg-emerald-100 text-emerald-900"
                      : reviewState === "awaiting_expenses"
                        ? "bg-amber-100 text-amber-900"
                        : reviewState === "returned"
                          ? "bg-blue-100 text-blue-900"
                          : "bg-muted text-muted-foreground"
                  }`}
                >
                  {reviewState === "ready"
                    ? "Ready to complete"
                    : reviewState === "awaiting_expenses"
                      ? "Awaiting expenses"
                      : reviewState === "returned"
                        ? "Returned / needs changes"
                        : "Awaiting submission"}
                </span>
              </div>
              <div className="rounded-md border border-primary/30 bg-card p-3 shadow-sm">
                <FollowUpActionBar
                  workOrderId={data.id}
                  onDone={() => onOpenChange(false)}
                  blockClose={expensesPending}
                />
              </div>
            </section>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

function Section({
  title,
  children,
  icon: Icon,
  step,
  tone,
  statusLabel,
}: {
  title: string;
  children: React.ReactNode;
  icon?: React.ComponentType<{ className?: string }>;
  step?: number;
  tone?: "warn" | "ok";
  statusLabel?: string;
}) {
  const toneClass =
    tone === "warn"
      ? "border-amber-300/70"
      : tone === "ok"
        ? "border-emerald-300/70"
        : "border-border";
  return (
    <section>
      <div className="mb-2 flex items-center justify-between">
        <h3 className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          {step ? (
            <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-muted text-[9px] font-bold text-foreground">
              {step}
            </span>
          ) : null}
          {Icon ? <Icon className="h-3 w-3" /> : null}
          {title}
        </h3>
        {statusLabel ? (
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
            {statusLabel}
          </span>
        ) : null}
      </div>
      <div className={`space-y-2 rounded-md border ${toneClass} bg-card p-3`}>
        {children}
      </div>
    </section>
  );
}

function ReviewStatusBanner({
  state,
}: {
  state: "returned" | "awaiting_expenses" | "ready" | "needs_submission";
}) {
  const config = {
    ready: {
      cls: "border-emerald-300 bg-emerald-50 text-emerald-950",
      icon: CheckCircle2,
      title: "Ready to complete",
      body: "Engineer submission and expenses are settled. Pick a completion decision below.",
    },
    awaiting_expenses: {
      cls: "border-amber-300 bg-amber-50 text-amber-950",
      icon: AlertTriangle,
      title: "Awaiting expense acknowledgement",
      body: "Review and push the engineer's expenses to the ledger before closing.",
    },
    returned: {
      cls: "border-blue-300 bg-blue-50 text-blue-950",
      icon: RotateCcw,
      title: "Returned for changes",
      body: "This job was sent back for follow-up. Re-review once the engineer resubmits.",
    },
    needs_submission: {
      cls: "border-border bg-muted/50 text-foreground",
      icon: ClipboardList,
      title: "Awaiting engineer submission",
      body: "No field submission yet — nothing to review.",
    },
  }[state];
  const Icon = config.icon;
  return (
    <div className={`flex items-start gap-2 rounded-md border px-3 py-2 text-xs ${config.cls}`}>
      <Icon className="mt-0.5 h-4 w-4 shrink-0" />
      <div>
        <div className="text-[11px] font-bold uppercase tracking-wider">{config.title}</div>
        <div className="mt-0.5">{config.body}</div>
      </div>
    </div>
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