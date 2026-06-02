import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowLeft } from "lucide-react";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { DispatcherShell } from "@/components/DispatcherShell";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { Button } from "@/components/ui/button";
import {
  CreateWorkOrderForm,
  type CreatedWorkOrder,
} from "@/components/admin/CreateWorkOrderForm";
import { WorkOrderDocument } from "@/components/admin/WorkOrderDocument";
import { useWorkOrder } from "@/hooks/useWorkOrders";

export const Route = createFileRoute("/admin/work-orders/new")({
  head: () => ({ meta: [{ title: "New work order · OCS" }] }),
  component: NewWorkOrderPage,
});

function NewWorkOrderPage() {
  const navigate = useNavigate();
  const [createdId, setCreatedId] = useState<string | null>(null);
  const { data: createdWo } = useWorkOrder(createdId);

  const handleCreated = (wo: CreatedWorkOrder) => {
    setCreatedId(wo.id);
  };

  return (
    <ProtectedRoute requireRole="dispatcher">
      <DispatcherShell>
        <div className="mx-auto max-w-4xl space-y-4">
          <div className="flex items-center justify-between gap-3">
            <AdminPageHeader
              title="New work order"
              description="Fill in client, address, job and (optionally) engineer assignment. You'll get a printable copy when it's created."
            />
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate({ to: "/admin/dispatch" })}
              className="gap-1.5"
            >
              <ArrowLeft className="h-3.5 w-3.5" /> Back to dispatch
            </Button>
          </div>

          <div className="rounded-lg border border-border bg-card p-4 sm:p-6">
            <CreateWorkOrderForm
              onCreated={handleCreated}
              onCancel={() => navigate({ to: "/admin/dispatch" })}
            />
          </div>
        </div>

        {createdWo ? (
          <WorkOrderDocument
            wo={createdWo}
            open={!!createdId}
            onOpenChange={(v) => {
              if (!v) {
                setCreatedId(null);
                // After they close the printable popup, send them to the
                // dispatch board with the new order in focus.
                navigate({
                  to: "/admin/dispatch",
                  search: { focus: createdWo.id },
                });
              }
            }}
          />
        ) : null}
      </DispatcherShell>
    </ProtectedRoute>
  );
}