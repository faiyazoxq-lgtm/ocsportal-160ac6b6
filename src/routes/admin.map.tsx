import { createFileRoute } from "@tanstack/react-router";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { DispatcherShell } from "@/components/DispatcherShell";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { WorkOrderMapPanel } from "@/components/map/WorkOrderMapPanel";

export const Route = createFileRoute("/admin/map")({
  head: () => ({ meta: [{ title: "Map View · OCS" }] }),
  component: AdminMapPage,
});

function AdminMapPage() {
  return (
    <ProtectedRoute requireRole="dispatcher">
      <DispatcherShell>
        <AdminPageHeader
          title="Map View"
          description="Geographic visibility of outstanding and scheduled jobs."
        />
        <div className="mt-4">
          <WorkOrderMapPanel />
        </div>
      </DispatcherShell>
    </ProtectedRoute>
  );
}