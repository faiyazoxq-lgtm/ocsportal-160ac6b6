import { createFileRoute, Link } from "@tanstack/react-router";
import { ClipboardCheck, MapPin, Inbox, RefreshCw, ArrowRight, Activity, CheckCircle2, PhoneCall } from "lucide-react";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { DispatcherShell } from "@/components/DispatcherShell";
import { useOpsDiagnostics } from "@/hooks/useOpsDiagnostics";
import { useClosedJobs } from "@/hooks/useDispatcherOpsViews";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { useWorkOrders, useConfirmClientForWorkOrder } from "@/hooks/useWorkOrders";
import { AWAITING_CONFIRMATION_STATUSES } from "@/types/workOrders";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/")({
  head: () => ({ meta: [{ title: "Dispatch Dashboard · OCS" }] }),
  component: AdminDashboardPage,
});

const CARDS = [
  {
    label: "Open jobs",
    hint: "Active work orders across all engineers",
    icon: Inbox,
    to: "/admin/dispatch",
  },
  {
    label: "Awaiting review",
    hint: "Completed jobs pending dispatcher sign-off",
    icon: ClipboardCheck,
    to: "/admin/review",
  },
  {
    label: "Jobs on site",
    hint: "Engineers currently attending a site",
    icon: MapPin,
    to: "/admin/on-site",
  },
  {
    label: "Pending sync",
    hint: "Field updates queued for upload",
    icon: RefreshCw,
    to: "/admin/dispatch",
  },
] as const;

function AdminDashboardPage() {
  const { data: ops } = useOpsDiagnostics();
  const closed = useClosedJobs(10);
  const awaiting = useWorkOrders(AWAITING_CONFIRMATION_STATUSES, {
    key: "awaiting_client_confirmation",
  });
  const confirmClient = useConfirmClientForWorkOrder();
  return (
    <ProtectedRoute requireRole="dispatcher">
      <DispatcherShell>
        <div className="mx-auto max-w-6xl">
          <header className="mb-6">
            <h1 className="text-lg font-semibold text-foreground">
              Operations overview
            </h1>
            <p className="text-sm text-muted-foreground">
              Snapshot of work order activity across the OCS field operation.
            </p>
          </header>

          {ops ? (
            <Link
              to="/admin/ops"
              className="mb-4 flex flex-wrap items-center gap-x-4 gap-y-1 rounded-md border border-border bg-card px-3 py-2 text-xs hover:bg-accent/40"
            >
              <span className="inline-flex items-center gap-1 font-semibold text-foreground">
                <Activity className="h-3.5 w-3.5" /> Workflow health
              </span>
              <span className="text-muted-foreground">Needs review: <b className="text-foreground">{ops.intake.needsReview}</b></span>
              <span className="text-muted-foreground">Parse fails: <b className={ops.intake.parseFailures > 0 ? "text-destructive" : "text-foreground"}>{ops.intake.parseFailures}</b></span>
              <span className="text-muted-foreground">Planner conflicts: <b className={ops.workOrders.plannerConflicts > 0 ? "text-destructive" : "text-foreground"}>{ops.workOrders.plannerConflicts}</b></span>
              <span className="text-muted-foreground">Telegram failed (24h): <b className={ops.telegram.failed24h > 0 ? "text-destructive" : "text-foreground"}>{ops.telegram.failed24h}</b></span>
              <span className="text-muted-foreground">Overdue follow-ups: <b className={ops.followUps.overdue > 0 ? "text-destructive" : "text-foreground"}>{ops.followUps.overdue}</b></span>
              <span className="ml-auto inline-flex items-center gap-1 text-primary">Open Ops & QA <ArrowRight className="h-3 w-3" /></span>
            </Link>
          ) : null}

          <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {CARDS.map((c) => {
              const Icon = c.icon;
              return (
                <Link
                  key={c.label}
                  to={c.to}
                  className="block rounded-md border border-border bg-card p-4 shadow-sm transition-colors hover:bg-accent/40"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                      {c.label}
                    </span>
                    <Icon className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <p className="mt-3 text-xs text-muted-foreground">{c.hint}</p>
                  <div className="mt-3 inline-flex items-center gap-1 text-[11px] font-medium text-primary">
                    Open <ArrowRight className="h-3 w-3" />
                  </div>
                </Link>
              );
            })}
          </section>

          <section className="mt-8">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
              <h2 className="flex min-w-0 items-center gap-2 text-sm font-semibold text-foreground">
                <PhoneCall className="h-4 w-4 text-slate-600" />
                Awaiting client confirmation
              </h2>
              <span className="text-xs text-muted-foreground">
                Sniffed jobs needing a phone confirmation before dispatch
                {awaiting.data ? ` · ${awaiting.data.length}` : ""}
              </span>
            </div>
            {awaiting.isLoading ? (
              <div className="h-24 animate-pulse rounded-md bg-muted/40" />
            ) : !awaiting.data || awaiting.data.length === 0 ? (
              <div className="rounded-md border border-dashed border-slate-300 bg-white px-4 py-8 text-center text-xs text-slate-600">
                No jobs awaiting client confirmation.
              </div>
            ) : (
              <div className="overflow-hidden rounded-md border border-slate-300 bg-white shadow-sm">
                <ul className="divide-y divide-slate-200">
                  {awaiting.data.map((w) => (
                    <li key={w.id} className="bg-white">
                      <div className="flex flex-col gap-2 px-3 py-2 text-xs sm:flex-row sm:items-center sm:gap-3">
                        <Link
                          to="/admin/dispatch"
                          search={{ focus: w.id }}
                          className="flex flex-1 flex-col gap-1 hover:opacity-80 sm:flex-row sm:items-center sm:gap-3"
                        >
                          <span className="min-w-[110px] font-semibold text-slate-900">
                            {w.order_no}
                          </span>
                          <span className="flex-1 truncate text-slate-900">
                            {w.job_summary || "—"}
                          </span>
                          <span className="min-w-[140px] truncate text-slate-600">
                            {w.client?.client_name || "—"}
                          </span>
                          <StatusBadge status={w.current_status} />
                        </Link>
                        <button
                          type="button"
                          disabled={confirmClient.isPending}
                          onClick={() => {
                            confirmClient.mutate(w.id, {
                              onSuccess: () =>
                                toast.success(`${w.order_no} confirmed — ready for dispatch`),
                              onError: (e) =>
                                toast.error(`Could not confirm: ${(e as Error).message}`),
                            });
                          }}
                          className="inline-flex items-center justify-center gap-1 self-start rounded-md bg-yellow-400 px-2.5 py-1.5 text-[11px] font-semibold text-slate-900 shadow-sm hover:bg-yellow-300 disabled:cursor-not-allowed disabled:opacity-60 sm:self-auto"
                        >
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          Confirmed with client
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </section>

          <section className="mt-8 grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Link
              to="/admin/diary"
              className="group block rounded-md border border-border bg-card transition-colors hover:bg-accent/30"
            >
              <div className="border-b border-border px-4 py-3">
                <h2 className="flex items-center justify-between text-sm font-semibold text-foreground">
                  Today's diary
                  <ArrowRight className="h-3.5 w-3.5 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                </h2>
                <p className="text-xs text-muted-foreground">
                  Open the diary planner to view scheduled visits.
                </p>
              </div>
              <div className="px-4 py-10 text-center text-xs text-muted-foreground">
                Click to open diary planning →
              </div>
            </Link>
            <Link
              to="/admin/review"
              className="group block rounded-md border border-border bg-card transition-colors hover:bg-accent/30"
            >
              <div className="border-b border-border px-4 py-3">
                <h2 className="flex items-center justify-between text-sm font-semibold text-foreground">
                  Review queue
                  <ArrowRight className="h-3.5 w-3.5 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                </h2>
                <p className="text-xs text-muted-foreground">
                  Completed jobs awaiting quality check.
                </p>
              </div>
              <div className="px-4 py-10 text-center text-xs text-muted-foreground">
                Click to open review queue →
              </div>
            </Link>
          </section>

          <section className="mt-8">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
              <h2 className="flex min-w-0 items-center gap-2 text-sm font-semibold text-foreground">
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                Recently closed jobs
              </h2>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                <span className="hidden sm:inline">Showing latest {closed.data?.length ?? 0}</span>
                <Link
                  to="/admin/closed-jobs"
                  className="inline-flex items-center gap-1 text-primary hover:underline"
                >
                  View all <ArrowRight className="h-3 w-3" />
                </Link>
              </div>
            </div>
            {closed.isLoading ? (
              <div className="h-24 animate-pulse rounded-md bg-muted/40" />
            ) : !closed.data || closed.data.length === 0 ? (
              <div className="rounded-md border border-dashed border-border bg-card px-4 py-8 text-center text-xs text-muted-foreground">
                No closed jobs yet.
              </div>
            ) : (
              <div className="overflow-hidden rounded-md border border-border bg-card">
                <ul className="divide-y divide-border">
                  {closed.data.map((w) => (
                    <li key={w.id}>
                      <Link
                        to="/admin/dispatch"
                        search={{ focus: w.id }}
                        className="flex flex-col gap-1 px-3 py-2 text-xs hover:bg-accent/30 sm:flex-row sm:items-center sm:gap-3"
                      >
                        <span className="min-w-[110px] font-medium text-foreground">
                          {w.order_no}
                        </span>
                        <span className="flex-1 truncate text-foreground">
                          {w.job_summary || "—"}
                        </span>
                        <span className="min-w-[140px] truncate text-muted-foreground">
                          {w.client?.client_name || "—"}
                        </span>
                        <span className="min-w-[110px] text-muted-foreground">
                          {new Date(w.updated_at).toLocaleDateString()}
                        </span>
                        <StatusBadge status={w.current_status} />
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </section>
        </div>
      </DispatcherShell>
    </ProtectedRoute>
  );
}