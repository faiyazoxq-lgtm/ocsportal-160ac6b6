import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  Clock,
  AlertCircle,
  Activity,
  Map as MapIcon,
  Phone,
  ExternalLink,
  Timer,
  User as UserIcon,
} from "lucide-react";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { DispatcherShell } from "@/components/DispatcherShell";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { WorkOrderDetail } from "@/components/admin/WorkOrderDetail";
import {
  useOnSiteWorkOrders,
  useTodayPlannedNotStarted,
} from "@/hooks/useDispatcherOpsViews";
import type { WorkOrderWithRelations, WorkOrderStatus } from "@/types/workOrders";

export const Route = createFileRoute("/admin/on-site")({
  head: () => ({ meta: [{ title: "Jobs on site · OCS" }] }),
  component: OnSitePage,
});

function OnSitePage() {
  const onSite = useOnSiteWorkOrders();
  const notStarted = useTodayPlannedNotStarted();
  const [selected, setSelected] = useState<string | null>(null);

  // Re-render every 30s so relative times ("12m ago", "overdue 8m") stay fresh.
  const [, setTick] = useState(0);
  useEffect(() => {
    const i = setInterval(() => setTick((n) => n + 1), 30_000);
    return () => clearInterval(i);
  }, []);

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
            variant="active"
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
            variant="pending"
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
  variant,
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
  variant: "active" | "pending";
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
            {rows.map((w) =>
              variant === "active" ? (
                <ActiveEngineerRow key={w.id} wo={w} onSelect={onSelect} />
              ) : (
                <NotStartedTodayRow key={w.id} wo={w} onSelect={onSelect} />
              ),
            )}
          </ul>
        </div>
      )}
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/*  Rows                                                                      */
/* -------------------------------------------------------------------------- */

function leadOf(w: WorkOrderWithRelations) {
  return w.assignments.find(
    (a) => a.assignment_role === "lead" && a.assignment_status !== "removed",
  );
}

function ActiveEngineerRow({
  wo,
  onSelect,
}: {
  wo: WorkOrderWithRelations;
  onSelect: (id: string) => void;
}) {
  const lead = leadOf(wo);
  const startedAt = wo.field_lock_started_at;
  const onSiteFor = startedAt ? formatElapsed(startedAt) : null;
  return (
    <li>
      <div
        role="button"
        tabIndex={0}
        onClick={() => onSelect(wo.id)}
        onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && onSelect(wo.id)}
        className="flex w-full cursor-pointer flex-col gap-1.5 px-3 py-2.5 text-xs hover:bg-accent/30 sm:flex-row sm:items-center sm:gap-3"
      >
        <div className="flex items-center gap-2 sm:min-w-[180px]">
          <OnSiteStatusBadge status={wo.current_status} />
          <span className="font-medium text-foreground">{wo.order_no}</span>
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-foreground">{wo.job_summary || "—"}</div>
          <div className="truncate text-muted-foreground">
            {wo.client?.client_name || "—"}
            {wo.postcode ? ` · ${wo.postcode}` : ""}
          </div>
        </div>
        <div className="flex items-center gap-1.5 text-muted-foreground sm:min-w-[160px]">
          <UserIcon className="h-3 w-3" />
          <span className="truncate">{lead?.engineer?.display_name ?? "Unassigned"}</span>
        </div>
        <div className="flex items-center gap-1.5 text-emerald-700 sm:min-w-[120px]">
          {onSiteFor ? (
            <>
              <Timer className="h-3 w-3" />
              <span title={new Date(startedAt!).toLocaleString()}>On site {onSiteFor}</span>
            </>
          ) : (
            <span className="text-muted-foreground">—</span>
          )}
        </div>
        <OnSiteQuickActions wo={wo} />
      </div>
    </li>
  );
}

function NotStartedTodayRow({
  wo,
  onSelect,
}: {
  wo: WorkOrderWithRelations;
  onSelect: (id: string) => void;
}) {
  const lead = leadOf(wo);
  const overdue = useMemo(() => computeOverdue(wo), [wo]);
  return (
    <li>
      <div
        role="button"
        tabIndex={0}
        onClick={() => onSelect(wo.id)}
        onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && onSelect(wo.id)}
        className={`flex w-full cursor-pointer flex-col gap-1.5 px-3 py-2.5 text-xs hover:bg-accent/30 sm:flex-row sm:items-center sm:gap-3 ${
          overdue.isOverdue ? "bg-red-50/40" : ""
        }`}
      >
        <div className="flex items-center gap-2 sm:min-w-[180px]">
          {overdue.isOverdue ? (
            <OverdueStartBadge minutesLate={overdue.minutesLate!} />
          ) : (
            <span className="inline-flex items-center gap-1 rounded-sm border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold text-amber-900">
              <Clock className="h-3 w-3" /> Not started
            </span>
          )}
          <span className="font-medium text-foreground">{wo.order_no}</span>
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-foreground">{wo.job_summary || "—"}</div>
          <div className="truncate text-muted-foreground">
            {wo.client?.client_name || "—"}
            {wo.postcode ? ` · ${wo.postcode}` : ""}
          </div>
        </div>
        <div className="flex items-center gap-1.5 text-muted-foreground sm:min-w-[160px]">
          <UserIcon className="h-3 w-3" />
          <span className="truncate">{lead?.engineer?.display_name ?? "Unassigned"}</span>
        </div>
        <div className="flex items-center gap-1.5 text-muted-foreground sm:min-w-[120px]">
          <Clock className="h-3 w-3" />
          <span className="truncate">{wo.diary_slot_label || formatScheduledTime(wo.scheduled_start_at) || "Today"}</span>
        </div>
        <OnSiteQuickActions wo={wo} />
      </div>
    </li>
  );
}

/* -------------------------------------------------------------------------- */
/*  Badges & quick actions                                                    */
/* -------------------------------------------------------------------------- */

function OnSiteStatusBadge({ status }: { status: WorkOrderStatus }) {
  const map: Record<string, { label: string; cls: string }> = {
    on_site: { label: "On site", cls: "bg-emerald-100 text-emerald-900 border-emerald-300" },
    field_in_progress: { label: "Working", cls: "bg-emerald-100 text-emerald-900 border-emerald-300" },
    en_route: { label: "En route", cls: "bg-sky-100 text-sky-900 border-sky-300" },
  };
  const m = map[status] ?? { label: status, cls: "bg-muted text-foreground border-border" };
  return (
    <span className={`inline-flex items-center gap-1 rounded-sm border px-1.5 py-0.5 text-[10px] font-semibold ${m.cls}`}>
      <span className="h-1.5 w-1.5 rounded-full bg-current opacity-80" />
      {m.label}
    </span>
  );
}

function OverdueStartBadge({ minutesLate }: { minutesLate: number }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-sm border border-red-300 bg-red-100 px-1.5 py-0.5 text-[10px] font-semibold text-red-900">
      <AlertCircle className="h-3 w-3" />
      Overdue {formatMinutes(minutesLate)}
    </span>
  );
}

function OnSiteQuickActions({ wo }: { wo: WorkOrderWithRelations }) {
  const phone = leadOf(wo)?.engineer?.contact_number ?? null;
  return (
    <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
      {phone ? (
        <a
          href={`tel:${phone}`}
          className="inline-flex h-7 w-7 items-center justify-center rounded-sm border border-border bg-background text-muted-foreground hover:bg-muted hover:text-foreground"
          title={`Call ${phone}`}
          aria-label="Call engineer"
        >
          <Phone className="h-3.5 w-3.5" />
        </a>
      ) : null}
      <Link
        to="/admin/dispatch"
        search={{ focus: wo.id }}
        className="inline-flex h-7 w-7 items-center justify-center rounded-sm border border-border bg-background text-muted-foreground hover:bg-muted hover:text-foreground"
        title="Open work order in dispatch"
        aria-label="Open in dispatch"
      >
        <ExternalLink className="h-3.5 w-3.5" />
      </Link>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Helpers                                                                   */
/* -------------------------------------------------------------------------- */

function formatElapsed(iso: string): string {
  const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60_000));
  return formatMinutes(mins);
}

function formatMinutes(mins: number): string {
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

function formatScheduledTime(iso: string | null | undefined): string | null {
  if (!iso) return null;
  try {
    return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  } catch {
    return null;
  }
}

/** Decide if a not-yet-started job is overdue based on scheduled_start_at or the start of diary_slot_label. */
function computeOverdue(wo: WorkOrderWithRelations): {
  isOverdue: boolean;
  minutesLate: number | null;
} {
  const now = Date.now();
  // Prefer explicit timestamp.
  if (wo.scheduled_start_at) {
    const t = new Date(wo.scheduled_start_at).getTime();
    if (!Number.isNaN(t) && now > t) {
      return { isOverdue: true, minutesLate: Math.round((now - t) / 60_000) };
    }
    return { isOverdue: false, minutesLate: null };
  }
  // Parse diary slot label, e.g. "09:00-11:00", "09:00", "AM" (skip non-time labels).
  const label = wo.diary_slot_label ?? "";
  const m = label.match(/(\d{1,2}):(\d{2})/);
  if (!m || !wo.diary_date) return { isOverdue: false, minutesLate: null };
  const [h, mm] = [Number(m[1]), Number(m[2])];
  const d = new Date(`${wo.diary_date}T00:00:00`);
  d.setHours(h, mm, 0, 0);
  const t = d.getTime();
  if (now > t) return { isOverdue: true, minutesLate: Math.round((now - t) / 60_000) };
  return { isOverdue: false, minutesLate: null };
}