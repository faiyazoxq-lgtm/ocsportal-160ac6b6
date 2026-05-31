import { createFileRoute } from "@tanstack/react-router";
import { BossAccessGuard } from "@/components/boss/BossAccessGuard";
import { BossShell } from "@/components/boss/BossShell";
import { PeopleDirectoryTable } from "@/components/people/PeopleDirectoryTable";

export const Route = createFileRoute("/boss/members")({
  head: () => ({ meta: [{ title: "Boss · People" }] }),
  component: () => (
    <BossAccessGuard>
      <BossShell>
        <header className="mb-4">
          <h1 className="text-base font-semibold text-foreground">People</h1>
          <p className="text-xs text-muted-foreground">
            One directory for staff accounts and external contacts. Manage staff sign-in, roles, and external contact details from here.
          </p>
        </header>
        <PeopleDirectoryTable mode="boss" />
      </BossShell>
    </BossAccessGuard>
  ),
});