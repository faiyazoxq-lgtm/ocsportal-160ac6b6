import { createFileRoute, useParams } from "@tanstack/react-router";
import { BossAccessGuard } from "@/components/boss/BossAccessGuard";
import { BossShell } from "@/components/boss/BossShell";
import { ExternalContactEditorForm } from "@/components/people/ExternalContactEditorForm";
import { usePeopleDirectory } from "@/hooks/usePeopleDirectory";

export const Route = createFileRoute("/boss/members/external/$id/edit")({
  head: () => ({ meta: [{ title: "Edit external contact · Boss" }] }),
  component: EditExternalPage,
});

function EditExternalPage() {
  const { id } = useParams({ from: "/boss/members/external/$id/edit" });
  const { data, isLoading, error } = usePeopleDirectory();
  const row =
    data?.find(
      (r) => r.kind === "external_contact" && r.external_contact_id === id,
    ) ?? null;

  return (
    <BossAccessGuard>
      <BossShell>
        <div className="px-2 py-4 sm:px-4 sm:py-6">
          {isLoading ? (
            <div className="mx-auto h-40 max-w-2xl animate-pulse rounded-2xl border border-border bg-muted/40" />
          ) : error ? (
            <div className="mx-auto max-w-2xl rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-900">
              Couldn't load contact. {(error as Error).message}
            </div>
          ) : !row ? (
            <div className="mx-auto max-w-2xl rounded-md border border-border bg-card p-6 text-sm text-muted-foreground">
              External contact not found.
            </div>
          ) : (
            <ExternalContactEditorForm mode="edit" row={row} />
          )}
        </div>
      </BossShell>
    </BossAccessGuard>
  );
}