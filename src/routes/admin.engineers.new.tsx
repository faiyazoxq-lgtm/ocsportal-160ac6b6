import { createFileRoute } from "@tanstack/react-router";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { DispatcherShell } from "@/components/DispatcherShell";
import { EngineerEditForm } from "@/components/admin/EngineerEditForm";

export const Route = createFileRoute("/admin/engineers/new")({
  head: () => ({ meta: [{ title: "New engineer · OCS" }] }),
  component: NewEngineerPage,
});

function NewEngineerPage() {
  return (
    <ProtectedRoute requireRole="dispatcher">
      <DispatcherShell>
        <div className="px-2 py-4 sm:px-4 sm:py-6">
          <EngineerEditForm engineer={null} />
        </div>
      </DispatcherShell>
    </ProtectedRoute>
  );
}