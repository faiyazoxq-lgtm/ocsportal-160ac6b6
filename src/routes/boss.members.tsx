import { createFileRoute } from "@tanstack/react-router";
import { BossAccessGuard } from "@/components/boss/BossAccessGuard";
import { BossShell } from "@/components/boss/BossShell";
import { BossStaffTable } from "@/components/boss/BossStaffTable";

export const Route = createFileRoute("/boss/members")({
  head: () => ({ meta: [{ title: "Boss · Members" }] }),
  component: () => (
    <BossAccessGuard>
      <BossShell>
        <header className="mb-4">
          <h1 className="text-base font-semibold text-foreground">Members</h1>
          <p className="text-xs text-muted-foreground">Create, edit, disable, and reset passwords for staff accounts.</p>
        </header>
        <BossStaffTable />
      </BossShell>
    </BossAccessGuard>
  ),
});