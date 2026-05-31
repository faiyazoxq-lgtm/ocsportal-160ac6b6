import { createFileRoute } from "@tanstack/react-router";
import { BossAccessGuard } from "@/components/boss/BossAccessGuard";
import { BossShell } from "@/components/boss/BossShell";
import { BossJobOverridePanel } from "@/components/boss/BossJobOverridePanel";
import { BossAuditTimeline } from "@/components/boss/BossAuditTimeline";

export const Route = createFileRoute("/boss/ops")({
  head: () => ({ meta: [{ title: "Boss · Ops & Audit" }] }),
  component: () => (
    <BossAccessGuard>
      <BossShell>
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2"><BossJobOverridePanel /></div>
          <div>
            <h2 className="mb-2 text-sm font-semibold">Audit timeline</h2>
            <BossAuditTimeline />
          </div>
        </div>
      </BossShell>
    </BossAccessGuard>
  ),
});