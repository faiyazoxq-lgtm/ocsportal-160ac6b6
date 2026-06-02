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

export const Route = createFileRoute("/admin/intake")({
  head: () => ({ meta: [{ title: "Intake Queue · OCS" }] }),
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
        <div className="mx-auto max-w-7xl space-y-8">
          <AdminPageHeader
            title="Intake Queue"
            description="Front door of the workflow — capture inbound work orders from email, uploads, webhooks and manual entry before parsing."
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

          <section className="rounded-md border border-border bg-card p-3">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
              <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Inbound channels
              </div>
              <div className="text-xs text-muted-foreground">
                {intake.data?.length ?? 0} captured sources
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {(["all", "email", "upload", "webhook", "manual"] as const).map((c) => {
                const count = c === "all" ? intake.data?.length ?? 0 : counts[c] ?? 0;
                const active = channelFilter === c;
                return (
                  <button
                    key={c}
                    onClick={() => setChannelFilter(c)}
                    className={`inline-flex items-center gap-2 rounded-md border px-2 py-1 text-xs transition-colors ${
                      active
                        ? "border-primary bg-primary/10 text-foreground"
                        : "border-border bg-background text-muted-foreground hover:bg-accent/40"
                    }`}
                  >
                    {c === "all" ? <span className="font-medium">All channels</span> : <IntakeChannelBadge source={c} />}
                    <span className="text-[10px] tabular-nums">{count}</span>
                  </button>
                );
              })}
              <button
                onClick={() => setDuplicatesOnly((v) => !v)}
                className={`ml-auto inline-flex items-center gap-2 rounded-md border px-2 py-1 text-xs transition-colors ${
                  duplicatesOnly
                    ? "border-amber-500 bg-amber-100 text-amber-900 dark:border-amber-700 dark:bg-amber-900/30 dark:text-amber-200"
                    : "border-border bg-background text-muted-foreground hover:bg-accent/40"
                }`}
                title="Show only intake records with duplicate candidates"
              >
                <span className="font-medium">Duplicates only</span>
                <span className="text-[10px] tabular-nums">{duplicatesCount}</span>
              </button>
            </div>
          </section>

          <section className="rounded-md border border-border bg-card p-3">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
              <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Dispatch readiness
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <label className="uppercase tracking-wider">Sort</label>
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
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
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
                    className={`inline-flex items-center gap-2 rounded-md border px-2 py-1 text-xs transition-colors ${
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
          </section>

          <section>
            <h2 className="mb-2 text-sm font-medium text-foreground">
              Intake records · {channelFilter === "all" ? "all channels" : `${channelFilter} only`}
              {readinessFilter !== "all" ? ` · ${READINESS_LABEL[readinessFilter as Exclude<ReadinessFilter, "all">]}` : ""}
              {" · "}{filteredIntake.length} shown
            </h2>
            <IntakeRecordsTable
              rows={filteredIntake}
              isLoading={intake.isLoading}
              error={intake.error}
              onRowClick={setIntakeSelected}
            />
          </section>

          <section>
            <h2 className="mb-2 text-sm font-medium text-foreground">
              Work orders in intake pipeline
            </h2>
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