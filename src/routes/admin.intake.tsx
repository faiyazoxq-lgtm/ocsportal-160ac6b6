import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { DispatcherShell } from "@/components/DispatcherShell";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { WorkOrderTable } from "@/components/admin/WorkOrderTable";
import { WorkOrderDetail } from "@/components/admin/WorkOrderDetail";
import { CreateWorkOrderDialog } from "@/components/admin/CreateWorkOrderDialog";
import { useWorkOrders } from "@/hooks/useWorkOrders";
import { INTAKE_STATUSES } from "@/types/workOrders";
import { IntakeRecordsTable } from "@/components/admin/intake/IntakeRecordsTable";
import { IntakeReviewDrawer } from "@/components/admin/intake/IntakeReviewDrawer";
import { AddManualIntakeDialog } from "@/components/admin/intake/AddManualIntakeDialog";
import { IntakeChannelBadge } from "@/components/admin/intake/IntakeChannelBadge";
import { IntakeSyncNowButton } from "@/components/admin/intake/IntakeSyncNowButton";
import { useIntakeQueue } from "@/hooks/useIntake";
import { useIntakePrioritization, type ReadinessFilter, type SortKey } from "@/hooks/useIntakePrioritization";
import { READINESS_LABEL } from "@/lib/dispatchReadiness";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import type { IntakeSourceType } from "@/types/intake";
import { Inbox, AlertTriangle, CheckCircle2, Copy as CopyIcon } from "lucide-react";

export const Route = createFileRoute("/admin/intake")({
  head: () => ({ meta: [{ title: "Email Intake Queue · OCS" }] }),
  validateSearch: (s: Record<string, unknown>) => ({
    focus: typeof s.focus === "string" ? s.focus : undefined,
  }),
  component: IntakePage,
});

function IntakePage() {
  const { focus } = Route.useSearch();
  const navigate = Route.useNavigate();
  const [selected, setSelected] = useState<string | null>(null);
  const [intakeSelected, setIntakeSelected] = useState<string | null>(null);
  const [channelFilter, setChannelFilter] = useState<IntakeSourceType | "all">("all");
  const [duplicatesOnly, setDuplicatesOnly] = useState(false);
  const [readinessFilter, setReadinessFilter] = useState<ReadinessFilter>("all");
  const [sortKey, setSortKey] = useState<SortKey>("priority");
  useEffect(() => {
    if (focus) setIntakeSelected(focus);
  }, [focus]);
  const { data, isLoading, error } = useWorkOrders(INTAKE_STATUSES, {
    key: "intake",
  });
  const intake = useIntakeQueue();
  const qc = useQueryClient();

  const channelFiltered = (intake.data ?? []).filter((r) => {
    if (channelFilter !== "all" && r.source_type !== channelFilter) return false;
    if (duplicatesOnly) {
      const hasCandidates = (r.duplicate_candidates_json?.length ?? 0) > 0;
      const settled = r.duplicate_review_status === "confirmed" || r.duplicate_review_status === "linked";
      if (!hasCandidates && !settled && r.parse_status !== "duplicate_suspected") return false;
    }
    return true;
  });

  const prioritized = useIntakePrioritization(channelFiltered, {
    readiness: readinessFilter,
    sort: sortKey,
  });
  const filteredIntake = prioritized.rows.map((p) => p.record);

  const duplicatesCount = (intake.data ?? []).filter(
    (r) =>
      (r.duplicate_candidates_json?.length ?? 0) > 0 ||
      r.parse_status === "duplicate_suspected" ||
      r.duplicate_review_status === "confirmed" ||
      r.duplicate_review_status === "linked",
  ).length;

  const counts = (intake.data ?? []).reduce<Record<string, number>>((acc, r) => {
    acc[r.source_type] = (acc[r.source_type] ?? 0) + 1;
    return acc;
  }, {});

  const totalIntake = intake.data?.length ?? 0;
  const readyCount = prioritized.counts.ready ?? 0;
  const needsReviewCount = prioritized.counts.needs_review ?? 0;

  async function seedSampleIntake() {
    const { data: u } = await supabase.auth.getUser();
    const { error } = await supabase.from("intake_records").insert({
      source_type: "email",
      source_reference: `sample-${Date.now()}@inbox`,
      raw_text:
        "From: repairs@camden-demo.gov.uk\nSubject: Boiler fault NW1\n\nTenant at 12 Greenleaf House, NW1 0EX reports boiler clicking then shutting down. No hot water.",
      extracted_fields_json: {
        client_name: "Camden Council Housing",
        address_line_1: "12 Greenleaf House",
        city: "London",
        postcode: "NW1 0EX",
        job_summary: "Boiler not firing - no hot water",
        job_description: "Tenant reports boiler clicking then shutting down.",
        contact_phone: "020 7946 0011",
      } as never,
      suggested_categorization_json: {
        priority_level: "high",
        postcode_zone: "NW1",
        engineers_required: 1,
        diary_ready: true,
      } as never,
      missing_fields_json: ["order_no"] as never,
      parsing_issues_json: [] as never,
      duplicate_candidates_json: [] as never,
      parse_status: "needs_review",
      parse_confidence: 0.78,
      categorization_confidence: 0.86,
      duplicate_confidence: 0,
      created_by: u.user?.id ?? null,
    });
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Sample intake created");
    qc.invalidateQueries({ queryKey: ["intake_records"] });
  }

  return (
    <ProtectedRoute requireRole="dispatcher">
      <DispatcherShell>
        <div className="mx-auto max-w-7xl space-y-6">
          <AdminPageHeader
            title="Email Intake Queue"
            description="Review inbound work orders, verify extraction, then convert into jobs."
            actions={
              <div className="flex gap-2">
                <IntakeSyncNowButton />
                <Button variant="outline" size="sm" onClick={seedSampleIntake}>
                  + Sample intake
                </Button>
                <AddManualIntakeDialog triggerLabel="Capture source" />
                <CreateWorkOrderDialog />
              </div>
            }
          />

          {/* 1. KPI strip — most important counts at a glance */}
          <section
            aria-label="Intake summary"
            className="grid grid-cols-2 gap-2 sm:grid-cols-4"
          >
            <KpiTile
              icon={<Inbox className="h-3.5 w-3.5" />}
              label="Captured"
              value={totalIntake}
              tone="default"
            />
            <KpiTile
              icon={<AlertTriangle className="h-3.5 w-3.5" />}
              label="Needs review"
              value={needsReviewCount}
              tone="warning"
              active={readinessFilter === "needs_review"}
              onClick={() =>
                setReadinessFilter(readinessFilter === "needs_review" ? "all" : "needs_review")
              }
            />
            <KpiTile
              icon={<CheckCircle2 className="h-3.5 w-3.5" />}
              label="Ready to convert"
              value={readyCount}
              tone="success"
              active={readinessFilter === "ready"}
              onClick={() =>
                setReadinessFilter(readinessFilter === "ready" ? "all" : "ready")
              }
            />
            <KpiTile
              icon={<CopyIcon className="h-3.5 w-3.5" />}
              label="Duplicates"
              value={duplicatesCount}
              tone="warning"
              active={duplicatesOnly}
              onClick={() => setDuplicatesOnly((v) => !v)}
            />
          </section>

          {/* 2. Filters — channels + readiness + sort, grouped */}
          <section
            aria-label="Filters"
            className="rounded-md border border-border bg-card p-3 space-y-3"
          >
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Channel
              </div>
              <div className="flex flex-wrap gap-1.5">
                {(["all", "email", "upload", "webhook", "manual"] as const).map((c) => {
                  const count = c === "all" ? totalIntake : counts[c] ?? 0;
                  const active = channelFilter === c;
                  return (
                    <button
                      key={c}
                      onClick={() => setChannelFilter(c)}
                      className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs transition-colors ${
                        active
                          ? "border-primary bg-primary/10 text-foreground"
                          : "border-border bg-background text-muted-foreground hover:bg-accent/40"
                      }`}
                    >
                      {c === "all" ? (
                        <span className="font-medium">All</span>
                      ) : (
                        <IntakeChannelBadge source={c} />
                      )}
                      <span className="text-[10px] tabular-nums">{count}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex flex-col gap-2 border-t border-border pt-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Readiness
              </div>
              <div className="flex flex-wrap gap-1.5">
                {(
                  [
                    ["all", "All"],
                    ["ready", READINESS_LABEL.ready],
                    ["needs_review", READINESS_LABEL.needs_review],
                    ["incomplete", READINESS_LABEL.incomplete],
                    ["duplicate_pending", READINESS_LABEL.duplicate_pending],
                    ["parse_failed", READINESS_LABEL.parse_failed],
                    ["blocked", READINESS_LABEL.blocked],
                  ] as const
                ).map(([key, label]) => {
                  const count =
                    key === "all"
                      ? prioritized.total
                      : prioritized.counts[key as keyof typeof prioritized.counts] ?? 0;
                  const active = readinessFilter === key;
                  return (
                    <button
                      key={key}
                      onClick={() => setReadinessFilter(key as ReadinessFilter)}
                      className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs transition-colors ${
                        active
                          ? "border-primary bg-primary/10 text-foreground"
                          : "border-border bg-background text-muted-foreground hover:bg-accent/40"
                      }`}
                    >
                      <span className="font-medium">{label}</span>
                      <span className="text-[10px] tabular-nums">{count}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex flex-col gap-2 border-t border-border pt-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Sort
              </div>
              <div className="flex items-center gap-2">
                <select
                  value={sortKey}
                  onChange={(e) => setSortKey(e.target.value as SortKey)}
                  className="rounded-sm border border-border bg-background px-2 py-1 text-xs"
                >
                  <option value="priority">Priority (recommended)</option>
                  <option value="received_new">Newest first</option>
                  <option value="received_old">Oldest first</option>
                  <option value="client">Client</option>
                  <option value="zone">Postcode zone</option>
                  <option value="confidence">Parse confidence</option>
                </select>
                {duplicatesOnly ? (
                  <button
                    onClick={() => setDuplicatesOnly(false)}
                    className="rounded-sm border border-amber-500 bg-amber-100 px-2 py-1 text-[11px] font-medium text-amber-900 dark:border-amber-700 dark:bg-amber-900/30 dark:text-amber-200"
                    title="Clear duplicates-only filter"
                  >
                    Duplicates only ×
                  </button>
                ) : null}
              </div>
            </div>
          </section>

          {/* 3. Primary review table — biggest, most prominent */}
          <section aria-label="Intake records">
            <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-sm font-semibold text-foreground">
                Extracted from Company Gmail
              </h2>
              <div className="text-xs text-muted-foreground">
                {filteredIntake.length} shown
                {channelFilter !== "all" ? ` · ${channelFilter}` : ""}
                {readinessFilter !== "all"
                  ? ` · ${READINESS_LABEL[readinessFilter as Exclude<ReadinessFilter, "all">]}`
                  : ""}
              </div>
            </div>
            <IntakeRecordsTable
              rows={filteredIntake}
              isLoading={intake.isLoading}
              error={intake.error}
              onRowClick={setIntakeSelected}
            />
          </section>

          {/* 4. Secondary — work orders already moving through the pipeline */}
          <section aria-label="Work orders in pipeline">
            <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-sm font-semibold text-foreground">
                Work orders in pipeline
              </h2>
              <div className="text-xs text-muted-foreground">
                Converted from intake — pending dispatch
              </div>
            </div>
            <WorkOrderTable
              rows={data}
              isLoading={isLoading}
              error={error}
              onRowClick={setSelected}
              emptyMessage="No jobs are currently waiting in intake."
            />
          </section>
        </div>
        <WorkOrderDetail
          workOrderId={selected}
          open={!!selected}
          onOpenChange={(o) => !o && setSelected(null)}
        />
        <IntakeReviewDrawer
          intakeId={intakeSelected}
          open={!!intakeSelected}
          onOpenChange={(o) => {
            if (!o) {
              setIntakeSelected(null);
              if (focus) navigate({ search: { focus: undefined } });
            }
          }}
        />
      </DispatcherShell>
    </ProtectedRoute>
  );
}

type KpiTone = "default" | "success" | "warning";

function KpiTile({
  icon,
  label,
  value,
  tone = "default",
  active = false,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  tone?: KpiTone;
  active?: boolean;
  onClick?: () => void;
}) {
  const toneClasses =
    tone === "success"
      ? "text-emerald-600 dark:text-emerald-400"
      : tone === "warning"
        ? "text-amber-600 dark:text-amber-400"
        : "text-muted-foreground";
  const baseBorder = active
    ? "border-primary ring-1 ring-primary/30"
    : "border-border";
  const Component = onClick ? "button" : "div";
  return (
    <Component
      onClick={onClick}
      className={`flex items-center justify-between gap-2 rounded-md border bg-card px-3 py-2 text-left transition-colors ${baseBorder} ${
        onClick ? "hover:bg-accent/40" : ""
      }`}
      type={onClick ? "button" : undefined}
    >
      <div className="min-w-0">
        <div className={`flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider ${toneClasses}`}>
          {icon}
          <span className="truncate">{label}</span>
        </div>
        <div className="mt-0.5 text-xl font-semibold tabular-nums text-foreground">
          {value}
        </div>
      </div>
    </Component>
  );
}