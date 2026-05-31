import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { DispatcherShell } from "@/components/DispatcherShell";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { WorkOrderTable } from "@/components/admin/WorkOrderTable";
import { WorkOrderDetail } from "@/components/admin/WorkOrderDetail";
import { CreateWorkOrderDialog } from "@/components/admin/CreateWorkOrderDialog";
import { useWorkOrders } from "@/hooks/useWorkOrders";
import { DISPATCH_STATUSES } from "@/types/workOrders";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/admin/dispatch")({
  head: () => ({ meta: [{ title: "Dispatch Board · OCS" }] }),
  component: DispatchPage,
});

function DispatchPage() {
  const [selected, setSelected] = useState<string | null>(null);
  const [trade, setTrade] = useState("");
  const [zone, setZone] = useState("");
  const [complexity, setComplexity] = useState("");
  const [priority, setPriority] = useState("");

  const { data, isLoading, error } = useWorkOrders(DISPATCH_STATUSES, {
    key: "dispatch",
  });

  const filtered = useMemo(() => {
    return (data ?? []).filter((w) => {
      if (trade && !(w.primary_trade ?? "").toLowerCase().includes(trade.toLowerCase()))
        return false;
      if (zone && (w.postcode_zone ?? "").toLowerCase() !== zone.toLowerCase())
        return false;
      if (complexity && w.complexity_level !== complexity) return false;
      if (priority && w.priority_level !== priority) return false;
      return true;
    });
  }, [data, trade, zone, complexity, priority]);

  return (
    <ProtectedRoute requireRole="dispatcher">
      <DispatcherShell>
        <div className="mx-auto max-w-7xl">
          <AdminPageHeader
            title="Dispatch Board"
            description="Jobs ready to schedule and assign to engineers."
            actions={
              <>
                <Button size="sm" variant="outline" disabled>
                  Assign engineers
                </Button>
                <CreateWorkOrderDialog />
              </>
            }
          />

          <div className="mb-4 grid grid-cols-2 gap-2 md:grid-cols-4">
            <Input
              placeholder="Trade"
              value={trade}
              onChange={(e) => setTrade(e.target.value)}
            />
            <Input
              placeholder="Postcode zone"
              value={zone}
              onChange={(e) => setZone(e.target.value)}
            />
            <select
              value={complexity}
              onChange={(e) => setComplexity(e.target.value)}
              className="h-9 rounded-md border border-input bg-background px-2 text-sm"
            >
              <option value="">Any complexity</option>
              <option value="basic">Basic</option>
              <option value="intermediate">Intermediate</option>
              <option value="advanced">Advanced</option>
            </select>
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