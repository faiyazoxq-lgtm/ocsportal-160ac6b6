import { createFileRoute } from "@tanstack/react-router";
import { BossAccessGuard } from "@/components/boss/BossAccessGuard";
import { BossShell } from "@/components/boss/BossShell";
import { useBossStaffList } from "@/hooks/useBossStaffManagement";
import { CompanySettingsPanel } from "@/components/boss/CompanySettingsPanel";
import { LinkedMailboxPanel } from "@/components/boss/LinkedMailboxPanel";
import { WorkOrderStatusColorSettings } from "@/components/boss/WorkOrderStatusColorSettings";
import { EngineerPermissionsSettings } from "@/components/boss/EngineerPermissionsSettings";
import { EmailTemplatesPanel } from "@/components/boss/EmailTemplatesPanel";
import { RecommendedSiteToggles } from "@/components/boss/RecommendedSiteToggles";

export const Route = createFileRoute("/boss/infrastructure")({
  head: () => ({ meta: [{ title: "Boss · Site settings & integrations" }] }),
  component: BossInfraPage,
});

function BossInfraPage() {
  const { data } = useBossStaffList();
  const pendingResets = (data ?? []).filter((s) => s.password_reset_requested_at);
  return (
    <BossAccessGuard>
      <BossShell>
        <header className="mb-4">
          <h1 className="text-base font-semibold text-foreground">
            Site settings &amp; integrations
          </h1>
          <p className="text-xs text-muted-foreground">
            Platform-wide controls for site identity, intake routing, dispatch theming
            and connected services.
          </p>
        </header>
        <div className="space-y-6">
          <SettingsGroup
            title="Recommended site toggles"
            description="Curated on/off switches for the most useful site-wide operational behaviors."
          >
            <RecommendedSiteToggles />
          </SettingsGroup>

          <SettingsGroup
            title="Site settings"
            description="Identity and contact details shown across the platform."
          >
            <CompanySettingsPanel />
          </SettingsGroup>

          <SettingsGroup
            title="Linked mailbox & intake"
            description="Where inbound work-order emails arrive and how they're routed into the parsing flow."
          >
            <LinkedMailboxPanel />
          </SettingsGroup>

          <SettingsGroup
            title="Work-order status colours"
            description="Theme ALL WORK ORDERS so every status is instantly recognisable."
          >
            <WorkOrderStatusColorSettings />
          </SettingsGroup>

          <SettingsGroup
            title="Engineer permissions"
            description="Toggle exactly which contact, work-order, communication and directory fields engineers are allowed to see."
          >
            <EngineerPermissionsSettings />
          </SettingsGroup>

          <SettingsGroup
            title="OCSBot email templates"
            description="Reusable subject + body presets used by the Telegram Emails flow. Use {{name}} to insert the recipient's name."
          >
            <EmailTemplatesPanel />
          </SettingsGroup>

          <SettingsGroup
            title="Security & access"
            description="Auth-level admin tooling and audit signals."
          >
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
          </SettingsGroup>
        </div>
      </BossShell>
    </BossAccessGuard>
  );
}

function SettingsGroup({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <div className="mb-2">
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
          {title}
        </h2>
        {description && (
          <p className="text-xs text-muted-foreground/80">{description}</p>
        )}
      </div>
      <div className="space-y-3">{children}</div>
    </section>
  );
}