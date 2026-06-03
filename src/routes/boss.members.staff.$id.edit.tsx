import { createFileRoute, useParams } from "@tanstack/react-router";
import { BossAccessGuard } from "@/components/boss/BossAccessGuard";
import { BossShell } from "@/components/boss/BossShell";
import { StaffEditorForm } from "@/components/people/StaffEditorForm";
import { useBossStaffList } from "@/hooks/useBossStaffManagement";

export const Route = createFileRoute("/boss/members/staff/$id/edit")({
  head: () => ({ meta: [{ title: "Edit staff · Boss" }] }),
  component: EditStaffPage,
});

function EditStaffPage() {
  const { id } = useParams({ from: "/boss/members/staff/$id/edit" });
  const { data, isLoading, error } = useBossStaffList();
  const row = data?.find((s) => s.id === id) ?? null;

  return (
    <BossAccessGuard>
      <BossShell>
        <div className="px-2 py-4 sm:px-4 sm:py-6">
          {isLoading ? (
            <div className="mx-auto h-40 max-w-2xl animate-pulse rounded-2xl border border-border bg-muted/40" />
          ) : error ? (
            <div className="mx-auto max-w-2xl rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-900">
              Couldn't load staff. {(error as Error).message}
            </div>
          ) : !row ? (
            <div className="mx-auto max-w-2xl rounded-md border border-border bg-card p-6 text-sm text-muted-foreground">
              Staff member not found.
            </div>
          ) : (
            <StaffEditorForm mode="edit" row={row} />
          )}
        </div>
      </BossShell>
    </BossAccessGuard>
  );
}