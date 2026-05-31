import { createFileRoute, Link } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Database,
  RefreshCw,
  Send,
  FileText,
  Inbox,
  Calendar,
  Receipt,
  PhoneCall,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { DispatcherShell } from "@/components/DispatcherShell";
import { useOpsDiagnostics } from "@/hooks/useOpsDiagnostics";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/admin/ops")({
  head: () => ({ meta: [{ title: "Ops & QA · OCS" }] }),
  component: OpsPage,
});

function StatBadge({ value, tone = "neutral" }: { value: number; tone?: "neutral" | "warn" | "bad" | "good" }) {
  const cls =
    value === 0 && tone !== "good"
      ? "bg-muted text-muted-foreground"
      : tone === "bad"
        ? "bg-destructive/10 text-destructive"
        : tone === "warn"
          ? "bg-amber-100 text-amber-900 dark:bg-amber-950/50 dark:text-amber-100"
          : tone === "good"
            ? "bg-emerald-100 text-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-100"
            : "bg-secondary text-secondary-foreground";
  return (
    <span className={`inline-flex min-w-[2rem] items-center justify-center rounded px-1.5 py-0.5 text-xs font-semibold tabular-nums ${cls}`}>
      {value}
    </span>
  );
}

function Row({
  label,
  value,
  tone,
  to,
  hint,
}: {
  label: string;
  value: number;
  tone?: "neutral" | "warn" | "bad" | "good";
  to?: string;
  hint?: string;
}) {
  const inner = (
    <div className="flex items-center justify-between gap-3 rounded-sm border border-border bg-background px-3 py-2 text-sm transition-colors hover:bg-accent/40">
      <div className="min-w-0">
        <div className="truncate text-foreground">{label}</div>
        {hint ? <div className="text-[11px] text-muted-foreground">{hint}</div> : null}
      </div>
      <StatBadge value={value} tone={tone} />
    </div>
  );
  return to ? <Link to={to}>{inner}</Link> : inner;
}

function Section({ title, icon: Icon, children }: { title: string; icon: any; children: React.ReactNode }) {
  return (
    <section className="rounded-md border border-border bg-card">
      <header className="flex items-center gap-2 border-b border-border px-3 py-2">
        <Icon className="h-4 w-4 text-muted-foreground" />
        <h2 className="text-sm font-semibold text-foreground">{title}</h2>
      </header>
      <div className="space-y-1 p-2">{children}</div>
    </section>
  );
}

function EnvDot({ ok, label }: { ok: boolean; label: string }) {
  return (
    <div className="flex items-center gap-2 rounded-sm border border-border bg-background px-2 py-1.5 text-xs">
      {ok ? (
        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
      ) : (
        <XCircle className="h-3.5 w-3.5 text-destructive" />
      )}
      <span className="text-foreground">{label}</span>
      <span className={`ml-auto text-[10px] font-medium ${ok ? "text-emerald-700 dark:text-emerald-400" : "text-destructive"}`}>
        {ok ? "configured" : "missing"}
      </span>
    </div>
  );
}

function OpsPage() {
  const { data, isLoading, refetch, isFetching } = useOpsDiagnostics();
  const qc = useQueryClient();
  const [reseeding, setReseeding] = useState(false);

  const reseed = async () => {
    setReseeding(true);
    const { error } = await supabase.rpc("seed_demo_data");
    setReseeding(false);
    if (error) return toast.error("Reseed failed", { description: error.message });
    await qc.invalidateQueries();
    toast.success("Staged data reset");
  };

  const flushTelegram = async () => {
    try {
      const { flushTelegramNotifications } = await import("@/lib/telegramDispatch.functions");
      const res = await (flushTelegramNotifications as any)({ data: { limit: 25 } });
      toast.success("Telegram flush queued", {
        description: `Processed: ${res?.processed ?? 0} · Failed: ${res?.failed ?? 0}`,
      });
      void refetch();
    } catch (e: any) {
      toast.error("Telegram flush failed", { description: e?.message });
    }
  };

  return (
    <ProtectedRoute requireRole="dispatcher">
      <DispatcherShell>
        <div className="mx-auto max-w-6xl space-y-4">
          <header className="flex items-center justify-between gap-3">
            <div>
              <h1 className="text-lg font-semibold text-foreground">Ops & QA diagnostics</h1>
              <p className="text-sm text-muted-foreground">
                Workflow health for staged testing. Auto-refreshes every 30s.
              </p>
            </div>
            <button
              type="button"
              onClick={() => void refetch()}
              disabled={isFetching}
              className="inline-flex items-center gap-1.5 rounded-sm border border-border bg-card px-2.5 py-1.5 text-xs font-medium hover:bg-accent disabled:opacity-60"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? "animate-spin" : ""}`} />
              Refresh
            </button>
          </header>

          {isLoading || !data ? (
            <div className="rounded-md border border-border bg-card p-6 text-sm text-muted-foreground">
              Loading diagnostics…
            </div>
          ) : (
            <>
              {/* Environment */}
              <section className="rounded-md border border-border bg-card">
                <header className="flex items-center justify-between gap-2 border-b border-border px-3 py-2">
                  <div className="flex items-center gap-2">
                    <Activity className="h-4 w-4 text-muted-foreground" />
                    <h2 className="text-sm font-semibold text-foreground">Environment & connectivity</h2>
                  </div>
                  <span className="rounded bg-secondary px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-secondary-foreground">
                    {data.env.appEnv}
                  </span>
                </header>
                <div className="grid grid-cols-2 gap-2 p-2 sm:grid-cols-4">
                  <EnvDot ok={data.env.telegramConfigured} label="Telegram" />
                  <EnvDot ok={data.env.plannerConfigured} label="Planner sync" />
                  <EnvDot ok={data.env.lovableAiConfigured} label="AI parser" />
                  <EnvDot ok={data.env.serviceRoleConfigured} label="Service role" />
                </div>
              </section>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                {/* Intake / Parser */}
                <Section title="Intake & parser" icon={Inbox}>
                  <Row label="Awaiting parse" value={data.intake.receivedQueue} tone="neutral" to="/admin/intake" />
                  <Row label="Needs review" value={data.intake.needsReview} tone={data.intake.needsReview > 0 ? "warn" : "neutral"} to="/admin/intake" />
                  <Row label="Duplicate suspected" value={data.intake.duplicatesSuspected} tone={data.intake.duplicatesSuspected > 0 ? "warn" : "neutral"} to="/admin/intake" />
                  <Row label="Parse failures" value={data.intake.parseFailures} tone={data.intake.parseFailures > 0 ? "bad" : "neutral"} to="/admin/intake" />
                  <Row label="Converted (24h)" value={data.intake.convertedLast24h} tone="good" to="/admin/intake" />
                  {data.intake.lastParseRun ? (
                    <div className="mt-1 rounded-sm bg-muted px-2 py-1.5 text-[11px] text-muted-foreground">
                      Last parse: <span className="font-medium text-foreground">{data.intake.lastParseRun.parse_method ?? "?"}</span>
                      {" · "}
                      v{data.intake.lastParseRun.parser_version ?? "?"}
                      {" · "}
                      {data.intake.lastParseRun.parsing_completed_at
                        ? new Date(data.intake.lastParseRun.parsing_completed_at).toLocaleString()
                        : "—"}
                      {data.intake.lastParseRun.parse_error ? (
                        <div className="mt-1 text-destructive">⚠ {data.intake.lastParseRun.parse_error}</div>
                      ) : null}
                    </div>
                  ) : null}
                </Section>

                {/* Work orders */}
                <Section title="Work orders" icon={FileText}>
                  <Row label="Awaiting review" value={data.workOrders.awaitingReview} tone={data.workOrders.awaitingReview > 0 ? "warn" : "neutral"} to="/admin/review" />
                  <Row label="Pending sync" value={data.workOrders.pendingSync} tone={data.workOrders.pendingSync > 0 ? "warn" : "neutral"} to="/admin/dispatch" />
                  <Row label="Field-locked" value={data.workOrders.fieldLocked} tone="neutral" to="/admin/dispatch" />
                  <Row label="Planner conflicts" value={data.workOrders.plannerConflicts} tone={data.workOrders.plannerConflicts > 0 ? "bad" : "neutral"} to="/admin/dispatch" />
                </Section>

                {/* Planner */}
                <Section title="Planner sync" icon={Calendar}>
                  <Row label="Sync failures (24h)" value={data.planner.syncFailures24h} tone={data.planner.syncFailures24h > 0 ? "bad" : "neutral"} />
                  <Row label="Sync conflicts (24h)" value={data.planner.syncConflicts24h} tone={data.planner.syncConflicts24h > 0 ? "warn" : "neutral"} />
                  {data.planner.lastSync ? (
                    <div className="rounded-sm bg-muted px-2 py-1.5 text-[11px] text-muted-foreground">
                      Last: <span className="font-medium text-foreground">{data.planner.lastSync.sync_direction}</span>
                      {" · "}<span className={data.planner.lastSync.sync_status === "failed" ? "text-destructive" : ""}>{data.planner.lastSync.sync_status}</span>
                      {" · "}{data.planner.lastSync.synced_at ? new Date(data.planner.lastSync.synced_at).toLocaleString() : "—"}
                      {data.planner.lastSync.error_message ? (
                        <div className="mt-1 text-destructive">⚠ {data.planner.lastSync.error_message}</div>
                      ) : null}
                    </div>
                  ) : (
                    <div className="rounded-sm bg-muted px-2 py-1.5 text-[11px] text-muted-foreground">No sync activity yet.</div>
                  )}
                </Section>

                {/* Files */}
                <Section title="Evidence files" icon={Database}>
                  <Row label="Failed uploads" value={data.files.failedSync} tone={data.files.failedSync > 0 ? "bad" : "neutral"} />
                  <Row label="Pending uploads" value={data.files.pendingSync} tone={data.files.pendingSync > 0 ? "warn" : "neutral"} />
                </Section>

                {/* Telegram */}
                <Section title="Telegram notifications" icon={Send}>
                  <Row label="Pending sends" value={data.telegram.pending} tone={data.telegram.pending > 0 ? "warn" : "neutral"} />
                  <Row label="Failed (24h)" value={data.telegram.failed24h} tone={data.telegram.failed24h > 0 ? "bad" : "neutral"} />
                  <button
                    type="button"
                    onClick={() => void flushTelegram()}
                    disabled={!data.env.telegramConfigured}
                    className="mt-1 inline-flex w-full items-center justify-center gap-1.5 rounded-sm border border-border bg-background px-2 py-1.5 text-xs font-medium hover:bg-accent disabled:opacity-50"
                  >
                    <Send className="h-3 w-3" /> Flush pending now
                  </button>
                </Section>

                {/* Billing & follow-ups */}
                <Section title="Billing & follow-ups" icon={Receipt}>
                  <Row label="Billing: pending review" value={data.billing.pendingReview} tone={data.billing.pendingReview > 0 ? "warn" : "neutral"} to="/admin/billing" />
                  <Row label="Billing: on hold" value={data.billing.onHold} tone={data.billing.onHold > 0 ? "warn" : "neutral"} to="/admin/billing" />
                  <Row label="Overdue follow-ups" value={data.followUps.overdue} tone={data.followUps.overdue > 0 ? "bad" : "neutral"} to="/admin/communications" />
                </Section>
              </div>

              {/* Smoke-test checklist */}
              <section className="rounded-md border border-border bg-card">
                <header className="flex items-center gap-2 border-b border-border px-3 py-2">
                  <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
                  <h2 className="text-sm font-semibold text-foreground">Manual smoke-test checklist</h2>
                </header>
                <ol className="space-y-1 p-2 text-xs">
                  {[
                    { label: "1. Create a manual intake record", to: "/admin/intake" },
                    { label: "2. Run parser & confirm extracted fields", to: "/admin/intake" },
                    { label: "3. Review & convert intake → work order", to: "/admin/intake" },
                    { label: "4. Assign engineer in dispatch board", to: "/admin/dispatch" },
                    { label: "5. Schedule on diary", to: "/admin/diary" },
                    { label: "6. Verify engineer sees job (impersonate or device)", to: "/admin/engineers" },
                    { label: "7. Submit completion → check review queue", to: "/admin/review" },
                    { label: "8. Confirm billing case created", to: "/admin/billing" },
                  ].map((step) => (
                    <li key={step.label}>
                      <Link
                        to={step.to}
                        className="flex items-center justify-between rounded-sm px-2 py-1.5 hover:bg-accent"
                      >
                        <span>{step.label}</span>
                        <span className="text-[10px] text-muted-foreground">open →</span>
                      </Link>
                    </li>
                  ))}
                </ol>
              </section>

              {/* Seed data */}
              <section className="rounded-md border border-amber-300/60 bg-amber-50 dark:bg-amber-950/30">
                <header className="flex items-center justify-between gap-2 border-b border-amber-300/60 px-3 py-2">
                  <div className="flex items-center gap-2 text-amber-900 dark:text-amber-100">
                    <AlertTriangle className="h-4 w-4" />
                    <h2 className="text-sm font-semibold">Staging data</h2>
                  </div>
                  <span className="text-[11px] text-amber-900 dark:text-amber-100">
                    {data.seed.stagedWorkOrders} staged work orders present
                  </span>
                </header>
                <div className="flex items-center justify-between gap-3 px-3 py-2 text-xs text-amber-900 dark:text-amber-100">
                  <span>
                    Re-seeding only touches <code className="rounded bg-amber-100/70 px-1 dark:bg-amber-900/40">OCS-DEMO-*</code> records. Real staged data is left untouched.
                  </span>
                  <button
                    type="button"
                    onClick={() => void reseed()}
                    disabled={reseeding}
                    className="inline-flex items-center gap-1.5 rounded-sm border border-amber-400/70 bg-white px-2.5 py-1 font-medium hover:bg-amber-100 disabled:opacity-60 dark:bg-amber-900/30"
                  >
                    <RefreshCw className={`h-3 w-3 ${reseeding ? "animate-spin" : ""}`} />
                    {reseeding ? "Reseeding…" : "Reset staged data"}
                  </button>
                </div>
              </section>
            </>
          )}
        </div>
      </DispatcherShell>
    </ProtectedRoute>
  );
}