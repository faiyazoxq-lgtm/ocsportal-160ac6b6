import { createFileRoute } from "@tanstack/react-router";
import { BossAccessGuard } from "@/components/boss/BossAccessGuard";
import { BossShell } from "@/components/boss/BossShell";
import { useBossStaffList } from "@/hooks/useBossStaffManagement";
import { CompanySettingsPanel } from "@/components/boss/CompanySettingsPanel";

export const Route = createFileRoute("/boss/infrastructure")({
  head: () => ({ meta: [{ title: "Boss · Infrastructure" }] }),
  component: BossInfraPage,
});

function BossInfraPage() {
  const { data } = useBossStaffList();
  const pendingResets = (data ?? []).filter((s) => s.password_reset_requested_at);
  return (
    <BossAccessGuard>
      <BossShell>
        <header className="mb-4">
          <h1 className="text-base font-semibold text-foreground">Infrastructure & security</h1>
          <p className="text-xs text-muted-foreground">Auth-level admin tools.</p>
        </header>
        <div className="space-y-4">
        <CompanySettingsPanel />
        <section className="rounded-md border border-border bg-card p-4">
          <h2 className="mb-2 text-sm font-semibold">Recent password reset requests</h2>
          {pendingResets.length ? (
            <ul className="space-y-1 text-xs">
              {pendingResets.map((s) => (
                <li key={s.id} className="flex justify-between border-b border-border py-1.5">
                  <span>{s.email}</span>
                  <span className="text-muted-foreground">
                    {new Date(s.password_reset_requested_at!).toLocaleString()}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-muted-foreground">No reset requests on record.</p>
          )}
        </section>
        </div>
      </BossShell>
    </BossAccessGuard>
  );
}