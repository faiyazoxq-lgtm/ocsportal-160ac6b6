import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { MapPin, Clock, AlertCircle, Activity, Map as MapIcon } from "lucide-react";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { DispatcherShell } from "@/components/DispatcherShell";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { WorkOrderDetail } from "@/components/admin/WorkOrderDetail";
import { StatusBadge } from "@/components/admin/StatusBadge";
import {
  useOnSiteWorkOrders,
  useTodayPlannedNotStarted,
} from "@/hooks/useDispatcherOpsViews";
import type { WorkOrderWithRelations } from "@/types/workOrders";

export const Route = createFileRoute("/admin/on-site")({
  head: () => ({ meta: [{ title: "Jobs on site · OCS" }] }),
  component: OnSitePage,
});

function OnSitePage() {
  const onSite = useOnSiteWorkOrders();
  const notStarted = useTodayPlannedNotStarted();
  const [selected, setSelected] = useState<string | null>(null);

  return (
    <ProtectedRoute requireRole="dispatcher">
      <DispatcherShell>
        <div className="mx-auto max-w-7xl space-y-6">
          <AdminPageHeader
            title="Jobs on site"
            description="Live view of engineers currently working and today's scheduled jobs not yet started."
            actions={
              <Link
                to="/admin/map"
                className="inline-flex items-center gap-1.5 rounded-sm border border-border bg-background px-3 py-1.5 text-xs font-medium hover:bg-muted"
              >
                <MapIcon className="h-3.5 w-3.5" /> Map view
              </Link>
            }
          />

          <Panel
            icon={<Activity className="h-4 w-4 text-emerald-600" />}
            title="On site / started"
            subtitle="Engineers actively working a job right now."
            tone="emerald"
            count={onSite.data?.length ?? 0}
            loading={onSite.isLoading}
            error={onSite.error}
            rows={onSite.data}
            emptyLabel="No engineers currently on site."
            onSelect={setSelected}
          />

          <Panel
            icon={<AlertCircle className="h-4 w-4 text-amber-600" />}
            title="Scheduled today — not started"
            subtitle="Assigned for today but the engineer hasn't reported en-route or on-site."
            tone="amber"
            count={notStarted.data?.length ?? 0}
            loading={notStarted.isLoading}
            error={notStarted.error}
            rows={notStarted.data}
            emptyLabel="All today's scheduled jobs have been started."
            onSelect={setSelected}
          />
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

function Panel({
  icon,
  title,
  subtitle,
  tone,
  count,
  loading,
  error,
  rows,
  emptyLabel,
  onSelect,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  tone: "emerald" | "amber";
  count: number;
  loading: boolean;
  error: unknown;
  rows: WorkOrderWithRelations[] | undefined;
  emptyLabel: string;
  onSelect: (id: string) => void;
}) {
  const toneClass =
    tone === "emerald"
      ? "bg-emerald-50 text-emerald-900 border-emerald-200"
      : "bg-amber-50 text-amber-900 border-amber-200";
  return (
    <section>
      <div className="mb-2 flex items-center gap-2">
        {icon}
        <h2 className="text-sm font-semibold text-foreground">{title}</h2>
        <span
          className={`rounded-sm border px-1.5 py-0.5 text-[10px] font-semibold ${toneClass}`}
        >
          {count}
        </span>
      </div>
      <p className="mb-2 text-xs text-muted-foreground">{subtitle}</p>
      {loading ? (
        <div className="h-24 animate-pulse rounded-md bg-muted/40" />
      ) : error ? (
        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-900">
          Couldn't load.
        </div>
      ) : !rows || rows.length === 0 ? (
        <div className="rounded-md border border-dashed border-border bg-card px-4 py-8 text-center text-sm text-muted-foreground">
          {emptyLabel}
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
                    onClick={() => onSelect(w.id)}
                    className="flex w-full flex-col gap-1 px-3 py-2.5 text-left text-xs hover:bg-accent/30 sm:flex-row sm:items-center sm:gap-3"
                  >
                    <div className="min-w-[110px] font-medium text-foreground">
                      {w.order_no}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="truncate text-foreground">
                        {w.job_summary || "—"}
                      </div>
                      <div className="truncate text-muted-foreground">
                        {w.client?.client_name || "—"}
                        {w.postcode ? ` · ${w.postcode}` : ""}
                      </div>
                    </div>
                    <div className="min-w-[160px] truncate text-muted-foreground">
                      <MapPin className="mr-1 inline h-3 w-3" />
                      {lead?.engineer?.display_name ?? "Unassigned"}
                    </div>
                    <div className="min-w-[110px] text-muted-foreground">
                      {w.diary_slot_label ? (
                        <>
                          <Clock className="mr-1 inline h-3 w-3" />
                          {w.diary_slot_label}
                        </>
                      ) : null}
                    </div>
                    <StatusBadge status={w.current_status} />
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </section>
  );
}