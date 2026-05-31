import { createFileRoute } from "@tanstack/react-router";
import { BossAccessGuard } from "@/components/boss/BossAccessGuard";
import { BossShell } from "@/components/boss/BossShell";
import { useBossAllWorkOrders, useBossAuditLog } from "@/hooks/useBossJobOverrides";
import { useBossStaffList } from "@/hooks/useBossStaffManagement";

export const Route = createFileRoute("/boss/overview")({
  head: () => ({ meta: [{ title: "Boss Overview · OCS" }] }),
  component: BossOverviewPage,
});

function Card({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <div className="rounded-md border border-border bg-card p-4">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-1 text-2xl font-semibold text-foreground">{value}</div>
      {hint && <div className="mt-1 text-[11px] text-muted-foreground">{hint}</div>}
    </div>
  );
}

function BossOverviewPage() {
  const { data: jobs } = useBossAllWorkOrders();
  const { data: staff } = useBossStaffList();
  const { data: audit } = useBossAuditLog(20);

  const open = (jobs ?? []).filter((j) => !["closed", "cancelled"].includes(j.current_status)).length;
  const closed = (jobs ?? []).filter((j) => j.current_status === "closed").length;
  const review = (jobs ?? []).filter((j) =>
    ["dispatcher_review", "field_submitted_complete", "field_submitted_incomplete"].includes(j.current_status)).length;
  const active = (staff ?? []).filter((s) => s.is_active).length;
  const disabled = (staff ?? []).filter((s) => !s.is_active).length;

  return (
    <BossAccessGuard>
      <BossShell>
        <header className="mb-4">
          <h1 className="text-base font-semibold text-foreground">System overview</h1>
          <p className="text-xs text-muted-foreground">Cross-system visibility for Boss / Super Admin.</p>
        </header>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Card label="Open jobs" value={open} />
          <Card label="Awaiting review" value={review} />
          <Card label="Closed jobs" value={closed} />
          <Card label="Active staff" value={active} hint={`${disabled} disabled`} />
        </div>
        <section className="mt-6">
          <h2 className="mb-2 text-sm font-semibold">Recent boss actions</h2>
          {audit?.length ? (
            <ul className="space-y-1.5 text-xs">
              {audit.map((a) => (
                <li key={a.id} className="rounded-sm border border-border bg-card px-3 py-1.5">
                  <span className="font-medium">{a.action_type}</span>
                  <span className="text-muted-foreground"> · {new Date(a.created_at).toLocaleString()}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-muted-foreground">No actions yet.</p>
          )}
        </section>
      </BossShell>
    </BossAccessGuard>
  );
}