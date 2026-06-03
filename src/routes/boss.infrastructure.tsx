import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { ChevronDown, Settings2, Mail, Palette, ShieldCheck, FileText, KeyRound, ToggleLeft, Send } from "lucide-react";
import { BossAccessGuard } from "@/components/boss/BossAccessGuard";
import { BossShell } from "@/components/boss/BossShell";
import { useBossStaffList } from "@/hooks/useBossStaffManagement";
import { CompanySettingsPanel } from "@/components/boss/CompanySettingsPanel";
import { LinkedMailboxPanel } from "@/components/boss/LinkedMailboxPanel";
import { WorkOrderStatusColorSettings } from "@/components/boss/WorkOrderStatusColorSettings";
import { EngineerPermissionsSettings } from "@/components/boss/EngineerPermissionsSettings";
import { EmailTemplatesPanel } from "@/components/boss/EmailTemplatesPanel";
import { RecommendedSiteToggles } from "@/components/boss/RecommendedSiteToggles";
import { TelegramRecipientsPanel } from "@/components/boss/TelegramRecipientsPanel";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

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
        <header className="surface-glow mb-5 px-5 py-5 md:px-6 md:py-6">
          <span className="glow-badge mb-3">Boss · Infrastructure</span>
          <h1 className="font-display text-2xl font-semibold leading-tight text-foreground md:text-3xl">
            Site settings &amp; integrations
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            Platform-wide controls for site identity, intake routing, dispatch
            theming and connected services.
          </p>
        </header>
        <div className="space-y-4">
          <SettingsGroup
            icon={ToggleLeft}
            title="Recommended site toggles"
            description="Curated on/off switches for the most useful site-wide operational behaviors."
            defaultOpen
          >
            <RecommendedSiteToggles />
          </SettingsGroup>

          <SettingsGroup
            icon={Settings2}
            title="Site settings"
            description="Identity and contact details shown across the platform."
          >
            <CompanySettingsPanel />
          </SettingsGroup>

          <SettingsGroup
            icon={Mail}
            title="Linked mailbox & intake"
            description="Where inbound work-order emails arrive and how they're routed into the parsing flow."
          >
            <LinkedMailboxPanel />
          </SettingsGroup>

          <SettingsGroup
            icon={Palette}
            title="Work-order status colours"
            description="Theme ALL WORK ORDERS so every status is instantly recognisable."
          >
            <WorkOrderStatusColorSettings />
          </SettingsGroup>

          <SettingsGroup
            icon={ShieldCheck}
            title="Engineer permissions"
            description="Toggle exactly which contact, work-order, communication and directory fields engineers are allowed to see."
          >
            <EngineerPermissionsSettings />
          </SettingsGroup>

          <SettingsGroup
            icon={FileText}
            title="OCSBot email templates"
            description="Reusable subject + body presets used by the Telegram Emails flow. Use {{name}} to insert the recipient's name."
          >
            <EmailTemplatesPanel />
          </SettingsGroup>

          <SettingsGroup
            icon={Send}
            title="Telegram recipients & alert routing"
            description="Manually link Telegram chat IDs to staff and choose exactly which notification types each person receives."
          >
            <TelegramRecipientsPanel />
          </SettingsGroup>

          <SettingsGroup
            icon={KeyRound}
            title="Security & access"
            description="Auth-level admin tooling and audit signals."
            badge={pendingResets.length ? `${pendingResets.length} pending` : undefined}
          >
            <div className="rounded-lg border border-border bg-card/60 p-4">
              <h3 className="mb-2 text-sm font-semibold text-foreground">Recent password reset requests</h3>
              {pendingResets.length ? (
                <ul className="divide-y divide-border text-sm">
                  {pendingResets.map((s) => (
                    <li key={s.id} className="flex items-center justify-between py-2">
                      <span className="font-medium text-foreground">{s.email}</span>
                      <span className="text-xs text-muted-foreground tabular-nums">
                        {new Date(s.password_reset_requested_at!).toLocaleString()}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">No reset requests on record.</p>
              )}
            </div>
          </SettingsGroup>
        </div>
      </BossShell>
    </BossAccessGuard>
  );
}

function SettingsGroup({
  icon: Icon,
  title,
  description,
  children,
  defaultOpen = false,
  badge,
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
  badge?: string;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <Collapsible
      open={open}
      onOpenChange={setOpen}
      className="card-glow group/section overflow-hidden rounded-xl border border-border bg-card shadow-sm transition-all"
    >
      <CollapsibleTrigger
        className={cn(
          "flex w-full items-center gap-4 px-5 py-4 text-left transition-colors",
          "hover:bg-accent/30",
        )}
      >
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary ring-1 ring-inset ring-primary/15">
          <Icon className="h-5 w-5" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2">
            <span className="font-display text-[17px] font-semibold leading-tight text-foreground">
              {title}
            </span>
            {badge && (
              <span className="inline-flex items-center rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-amber-700">
                {badge}
              </span>
            )}
          </span>
          {description && (
            <span className="mt-0.5 block text-[13px] leading-snug text-muted-foreground">
              {description}
            </span>
          )}
        </span>
        <ChevronDown
          className={cn(
            "h-5 w-5 shrink-0 text-muted-foreground transition-transform duration-200",
            open && "rotate-180 text-primary",
          )}
        />
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="border-t border-border bg-muted/20 px-5 py-5 space-y-3">
          {children}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}