import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { DispatcherShell } from "@/components/DispatcherShell";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { WorkOrderTable } from "@/components/admin/WorkOrderTable";
import { WorkOrderDetail } from "@/components/admin/WorkOrderDetail";
import { CreateWorkOrderDialog } from "@/components/admin/CreateWorkOrderDialog";
import { useWorkOrders } from "@/hooks/useWorkOrders";
import { INTAKE_STATUSES } from "@/types/workOrders";

export const Route = createFileRoute("/admin/intake")({
  head: () => ({ meta: [{ title: "Intake Queue · OCS" }] }),
  component: IntakePage,
});

function IntakePage() {
  const [selected, setSelected] = useState<string | null>(null);
  const { data, isLoading, error } = useWorkOrders(INTAKE_STATUSES, {
    key: "intake",
  });

  return (
    <ProtectedRoute requireRole="dispatcher">
      <DispatcherShell>
        <div className="mx-auto max-w-7xl">
          <AdminPageHeader
            title="Intake Queue"
            description="Jobs flowing in from email, PDF uploads, manual entry and webhooks."
            actions={<CreateWorkOrderDialog />}
          />
          <WorkOrderTable
            rows={data}
            isLoading={isLoading}
            error={error}
            onRowClick={setSelected}
            emptyMessage="No jobs are currently waiting in intake."
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