import { createFileRoute, Link } from "@tanstack/react-router";
import { Map as MapIcon } from "lucide-react";
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
import { DISPATCH_STATUSES } from "@/types/workOrders";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/admin/dispatch")({
  head: () => ({ meta: [{ title: "Dispatch Board · OCS" }] }),
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
  // Complexity filter removed from the UI; field kept on records for matching only.
  const [priority, setPriority] = useState("");

  const { data, isLoading, error } = useWorkOrders(DISPATCH_STATUSES, {
    key: "dispatch",
  });

  const filtered = useMemo(() => {
    const nq = nameQuery.trim().toLowerCase();
    const zq = zone.trim().toLowerCase();
    return (data ?? []).filter((w) => {
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
  }, [data, nameQuery, zone, priority]);

  const postcodeSuggestions = useMemo(() => {
    const set = new Set<string>();
    (data ?? []).forEach((w) => {
      if (w.postcode) set.add(w.postcode);
    });
    return Array.from(set).sort();
  }, [data]);

  return (
    <ProtectedRoute requireRole="dispatcher">
      <DispatcherShell>
        <div className="mx-auto max-w-7xl">
          <AdminPageHeader
            title="Dispatch Board"
            description="Jobs ready to schedule and assign to engineers."
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

          <div className="mb-3">
            <PlannerAutoPullToggle visibleIds={filtered.map((w) => w.id)} />
          </div>

          <div className="mb-4 grid grid-cols-2 gap-2 md:grid-cols-4">
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
          </div>

          <WorkOrderTable
            rows={filtered}
            isLoading={isLoading}
            error={error}
            onRowClick={setSelected}
            emptyMessage="No jobs are currently ready for dispatch."
            variant="dispatch"
          />
          {filtered.length > 0 && (
            <p className="mt-2 text-xs text-muted-foreground">
              Open a job to assign engineers.
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