import { createFileRoute, useParams } from "@tanstack/react-router";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { DispatcherShell } from "@/components/DispatcherShell";
import { EngineerEditForm } from "@/components/admin/EngineerEditForm";
import { useEngineers } from "@/hooks/useEngineers";

export const Route = createFileRoute("/admin/engineers/$id/edit")({
  head: () => ({ meta: [{ title: "Edit engineer · OCS" }] }),
  component: EditEngineerPage,
});

function EditEngineerPage() {
  const { id } = useParams({ from: "/admin/engineers/$id/edit" });
  const { data, isLoading, error } = useEngineers();
  const engineer = data?.find((e) => e.id === id) ?? null;

  return (
    <ProtectedRoute requireRole="dispatcher">
      <DispatcherShell>
        <div className="px-2 py-4 sm:px-4 sm:py-6">
          {isLoading ? (
            <div className="mx-auto h-40 max-w-5xl animate-pulse rounded-2xl border border-border bg-muted/40" />
          ) : error ? (
            <div className="mx-auto max-w-5xl rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-900">
              Couldn't load engineer. {(error as Error).message}
            </div>
          ) : !engineer ? (
            <div className="mx-auto max-w-5xl rounded-md border border-border bg-card p-6 text-sm text-muted-foreground">
              Engineer not found.
            </div>
          ) : (
            <EngineerEditForm engineer={engineer} />
          )}
        </div>
      </DispatcherShell>
    </ProtectedRoute>
  );
}