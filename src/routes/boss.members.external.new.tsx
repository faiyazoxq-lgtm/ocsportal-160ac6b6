import { createFileRoute } from "@tanstack/react-router";
import { BossAccessGuard } from "@/components/boss/BossAccessGuard";
import { BossShell } from "@/components/boss/BossShell";
import { ExternalContactEditorForm } from "@/components/people/ExternalContactEditorForm";

export const Route = createFileRoute("/boss/members/external/new")({
  head: () => ({ meta: [{ title: "New external contact · Boss" }] }),
  component: () => (
    <BossAccessGuard>
      <BossShell>
        <div className="px-2 py-4 sm:px-4 sm:py-6">
          <ExternalContactEditorForm mode="create" row={null} />
        </div>
      </BossShell>
    </BossAccessGuard>
  ),
});