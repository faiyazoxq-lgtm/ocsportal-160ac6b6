import { createFileRoute, Link } from "@tanstack/react-router";
import { Map as MapIcon, AlertTriangle, Calendar, UserCheck, CheckCircle2, ListFilter, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { DispatcherShell } from "@/components/DispatcherShell";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { WorkOrderTable } from "@/components/admin/WorkOrderTable";
import { WorkOrderDetail } from "@/components/admin/WorkOrderDetail";
import { CreateWorkOrderDialog } from "@/components/admin/CreateWorkOrderDialog";
import { AssignEngineersDialog } from "@/components/admin/AssignEngineersDialog";
import { ScheduleJobDrawer } from "@/components/admin/diary/ScheduleJobDrawer";
import { PlannerAutoPullToggle } from "@/components/admin/PlannerAutoPullToggle";
import { useWorkOrders } from "@/hooks/useWorkOrders";
import {
  DISPATCH_STATUSES,
  INTAKE_STATUSES,
  AWAITING_CONFIRMATION_STATUSES,
  type WorkOrderStatus,
} from "@/types/workOrders";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/admin/dispatch")({
  head: () => ({ meta: [{ title: "ALL WORK ORDERS · OCS" }] }),
  validateSearch: (s: Record<string, unknown>) => ({
    focus: typeof s.focus === "string" ? s.focus : undefined,
  }),
  component: DispatchPage,
});

function DispatchPage() {
  const { focus } = Route.useSearch();
  const navigate = Route.useNavigate();
  const [selected, setSelected] = useState<string | null>(null);
  useEffect(() => {
    if (focus) setSelected(focus);
  }, [focus]);
  const [assignTarget, setAssignTarget] = useState<string | null>(null);
  const [scheduleTarget, setScheduleTarget] = useState<string | null>(null);
  const [nameQuery, setNameQuery] = useState("");
  const [zone, setZone] = useState("");
  const [priority, setPriority] = useState("");
  const [statusTab, setStatusTab] = useState<"all" | WorkOrderStatus>("all");
  const [urgentOnly, setUrgentOnly] = useState(false);

  const ALL_ORDERS_STATUSES = useMemo<WorkOrderStatus[]>(
    () => [
      ...INTAKE_STATUSES,
      ...AWAITING_CONFIRMATION_STATUSES,
      ...DISPATCH_STATUSES,
    ],
    [],
  );

  const { data, isLoading, error } = useWorkOrders(ALL_ORDERS_STATUSES, {
    key: "dispatch-all",
  });

  const rows = data ?? [];

  const counts = useMemo(() => {
    const c = {
      all: rows.length,
      ready_for_dispatch: 0,
      scheduled_in_sheet: 0,
      assigned: 0,
      accepted: 0,
      urgent: 0,
    };
    rows.forEach((w) => {
      if (w.current_status in c) (c as any)[w.current_status] += 1;
      if (w.priority_level === "urgent") c.urgent += 1;
    });
    return c;
  }, [rows]);

  const filtered = useMemo(() => {
    const nq = nameQuery.trim().toLowerCase();
    const zq = zone.trim().toLowerCase();
    return rows.filter((w) => {
      if (statusTab !== "all" && w.current_status !== statusTab) return false;
      if (urgentOnly && w.priority_level !== "urgent") return false;
      if (nq) {
        const clientName = (w.client?.client_name ?? "").toLowerCase();
        if (!clientName.includes(nq)) return false;
      }
      if (zq) {
        const pc = (w.postcode ?? "").toLowerCase().replace(/\s+/g, "");
        const zoneVal = (w.postcode_zone ?? "").toLowerCase();
        const needle = zq.replace(/\s+/g, "");
        if (!pc.startsWith(needle) && !zoneVal.startsWith(needle)) return false;
      }
      if (priority && w.priority_level !== priority) return false;
      return true;
    });
  }, [rows, nameQuery, zone, priority, statusTab, urgentOnly]);

  const postcodeSuggestions = useMemo(() => {
    const set = new Set<string>();
    rows.forEach((w) => {
      if (w.postcode) set.add(w.postcode);
    });
    return Array.from(set).sort();
  }, [rows]);

  const hasActiveFilters =
    !!nameQuery || !!zone || !!priority || statusTab !== "all" || urgentOnly;

  const clearFilters = () => {
    setNameQuery("");
    setZone("");
    setPriority("");
    setStatusTab("all");
    setUrgentOnly(false);
  };

  return (
    <ProtectedRoute requireRole="dispatcher">
      <DispatcherShell>
        <div className="mx-auto max-w-7xl">
          <AdminPageHeader
            title="ALL WORK ORDERS"
            description="Triage, assign, and track jobs through to acceptance."
            actions={
              <>
                <Link
                  to="/admin/map"
                  className="inline-flex items-center gap-1.5 rounded-sm border border-border bg-background px-3 py-1.5 text-xs font-medium hover:bg-muted"
                >
                  <MapIcon className="h-3.5 w-3.5" /> Map view
                </Link>
                <CreateWorkOrderDialog />
              </>
            }
          />

          {/* Priority alert strip */}
          {counts.urgent > 0 && (
            <button
              type="button"
              onClick={() => setUrgentOnly((v) => !v)}
              className={cn(
                "mb-3 flex w-full items-center justify-between rounded-md border px-3 py-2 text-left text-sm transition",
                urgentOnly
                  ? "border-destructive bg-destructive/10 text-destructive"
                  : "border-destructive/40 bg-destructive/5 text-destructive hover:bg-destructive/10"
              )}
            >
              <span className="flex items-center gap-2 font-medium">
                <AlertTriangle className="h-4 w-4" />
                {counts.urgent} urgent job{counts.urgent === 1 ? "" : "s"} need action
              </span>
              <span className="text-xs opacity-80">
                {urgentOnly ? "Showing urgent only — tap to clear" : "Tap to filter"}
              </span>
            </button>
          )}

          {/* Status queue tabs */}
          <div className="mb-3 flex flex-wrap gap-1.5">
            <StatusTab active={statusTab === "all"} onClick={() => setStatusTab("all")} label="All" count={counts.all} />
            <StatusTab
              active={statusTab === "ready_for_dispatch"}
              onClick={() => setStatusTab("ready_for_dispatch")}
              label="Ready"
              count={counts.ready_for_dispatch}
              icon={ListFilter}
              tone="ready"
            />
            <StatusTab
              active={statusTab === "scheduled_in_sheet"}
              onClick={() => setStatusTab("scheduled_in_sheet")}
              label="Scheduled"
              count={counts.scheduled_in_sheet}
              icon={Calendar}
              tone="scheduled"
            />
            <StatusTab
              active={statusTab === "assigned"}
              onClick={() => setStatusTab("assigned")}
              label="Assigned"
              count={counts.assigned}
              icon={UserCheck}
              tone="assigned"
            />
            <StatusTab
              active={statusTab === "accepted"}
              onClick={() => setStatusTab("accepted")}
              label="Accepted"
              count={counts.accepted}
              icon={CheckCircle2}
              tone="accepted"
            />
          </div>

          <div className="mb-3">
            <PlannerAutoPullToggle visibleIds={filtered.map((w) => w.id)} />
          </div>

          <div className="mb-2 grid grid-cols-2 gap-2 md:grid-cols-4">
            <Input
              placeholder="Customer / agency name"
              value={nameQuery}
              onChange={(e) => setNameQuery(e.target.value)}
            />
            <div>
              <Input
                list="dispatch-postcode-suggestions"
                placeholder="Postcode (partial ok)"
                value={zone}
                onChange={(e) => setZone(e.target.value)}
              />
              <datalist id="dispatch-postcode-suggestions">
                {postcodeSuggestions.map((pc) => (
                  <option key={pc} value={pc} />
                ))}
              </datalist>
            </div>
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value)}
              className="h-9 rounded-md border border-input bg-background px-2 text-sm"
            >
              <option value="">Any priority</option>
              <option value="low">Low</option>
              <option value="normal">Normal</option>
              <option value="high">High</option>
              <option value="urgent">Urgent</option>
            </select>
            {hasActiveFilters && (
              <Button
                variant="ghost"
                size="sm"
                onClick={clearFilters}
                className="h-9 justify-start text-xs"
              >
                <X className="mr-1 h-3.5 w-3.5" /> Clear filters
              </Button>
            )}
          </div>

          <p className="mb-3 text-xs text-muted-foreground">
            Showing <span className="font-medium text-foreground">{filtered.length}</span> of {counts.all} jobs
            {statusTab !== "all" && <> · {labelFor(statusTab)}</>}
          </p>

          <WorkOrderTable
            rows={filtered}
            isLoading={isLoading}
            error={error}
            onRowClick={setSelected}
            emptyMessage={
              hasActiveFilters
                ? "No jobs match these filters. Try clearing them."
                : "Queue is clear — no jobs awaiting dispatch."
            }
            variant="dispatch"
          />
          {filtered.length > 0 && (
            <p className="mt-2 text-xs text-muted-foreground">
              Open a job to assign engineers, schedule, or view full detail.
            </p>
          )}
        </div>
        <WorkOrderDetail
          workOrderId={selected}
          open={!!selected}
          onOpenChange={(o) => {
            if (!o) {
              setSelected(null);
              if (focus) navigate({ search: { focus: undefined } });
            }
          }}
          onAssign={(id) => {
            setAssignTarget(id);
            setSelected(null);
          }}
          onSchedule={(id) => {
            setScheduleTarget(id);
            setSelected(null);
          }}
        />
        <AssignEngineersDialog
          workOrderId={assignTarget}
          open={!!assignTarget}
          onOpenChange={(o) => !o && setAssignTarget(null)}
          onScheduleInDiary={(id) => setScheduleTarget(id)}
        />
        <ScheduleJobDrawer
          workOrderId={scheduleTarget}
          onClose={() => setScheduleTarget(null)}
        />
      </DispatcherShell>
    </ProtectedRoute>
  );
}

const TONE_CLASSES: Record<string, { active: string; idle: string; dot: string }> = {
  ready: {
    active: "border-primary bg-primary text-primary-foreground",
    idle: "border-border bg-background hover:bg-muted",
    dot: "bg-primary",
  },
  scheduled: {
    active: "border-blue-500 bg-blue-500 text-white",
    idle: "border-border bg-background hover:bg-muted",
    dot: "bg-blue-500",
  },
  assigned: {
    active: "border-amber-500 bg-amber-500 text-white",
    idle: "border-border bg-background hover:bg-muted",
    dot: "bg-amber-500",
  },
  accepted: {
    active: "border-emerald-600 bg-emerald-600 text-white",
    idle: "border-border bg-background hover:bg-muted",
    dot: "bg-emerald-600",
  },
  default: {
    active: "border-foreground bg-foreground text-background",
    idle: "border-border bg-background hover:bg-muted",
    dot: "bg-muted-foreground",
  },
};

function StatusTab({
  active,
  onClick,
  label,
  count,
  icon: Icon,
  tone = "default",
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  count: number;
  icon?: React.ComponentType<{ className?: string }>;
  tone?: keyof typeof TONE_CLASSES;
}) {
  const t = TONE_CLASSES[tone];
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition",
        active ? t.active : t.idle
      )}
    >
      {Icon && <Icon className="h-3.5 w-3.5" />}
      <span>{label}</span>
      <span
        className={cn(
          "inline-flex min-w-[1.25rem] items-center justify-center rounded-full px-1.5 text-[10px] font-semibold",
          active ? "bg-white/20 text-current" : "bg-muted text-foreground"
        )}
      >
        {count}
      </span>
    </button>
  );
}

function labelFor(s: WorkOrderStatus): string {
  switch (s) {
    case "ready_for_dispatch":
      return "Ready for dispatch";
    case "scheduled_in_sheet":
      return "Scheduled";
    case "assigned":
      return "Assigned, awaiting acceptance";
    case "accepted":
      return "Accepted by engineer";
    default:
      return s;
  }
}