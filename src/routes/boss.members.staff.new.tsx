import { createFileRoute } from "@tanstack/react-router";
import { BossAccessGuard } from "@/components/boss/BossAccessGuard";
import { BossShell } from "@/components/boss/BossShell";
import { StaffEditorForm } from "@/components/people/StaffEditorForm";

export const Route = createFileRoute("/boss/members/staff/new")({
  head: () => ({ meta: [{ title: "New staff · Boss" }] }),
  component: () => (
    <BossAccessGuard>
      <BossShell>
        <div className="px-2 py-4 sm:px-4 sm:py-6">
          <StaffEditorForm mode="create" row={null} />
        </div>
      </BossShell>
    </BossAccessGuard>
  ),
});