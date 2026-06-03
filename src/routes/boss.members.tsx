import { createFileRoute } from "@tanstack/react-router";
import { BossAccessGuard } from "@/components/boss/BossAccessGuard";
import { BossShell } from "@/components/boss/BossShell";
import { PeopleDirectoryTable } from "@/components/people/PeopleDirectoryTable";

export const Route = createFileRoute("/boss/members")({
  head: () => ({ meta: [{ title: "Boss · People" }] }),
  component: () => (
    <BossAccessGuard>
      <BossShell>
        <header className="surface-glow mb-5 px-5 py-5 md:px-6 md:py-6">
          <span className="glow-badge mb-3">Boss · People</span>
          <h1 className="font-display text-2xl font-semibold leading-tight text-foreground md:text-3xl">
            People
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            One directory for staff accounts and external contacts. Manage staff
            sign-in, roles, and external contact details from here.
          </p>
        </header>
        <PeopleDirectoryTable mode="boss" />
      </BossShell>
    </BossAccessGuard>
  ),
});