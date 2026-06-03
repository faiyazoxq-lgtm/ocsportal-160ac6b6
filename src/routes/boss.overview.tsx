import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  ClipboardList, Users, Wrench, Activity, Mail, ShieldCheck,
  Receipt, PhoneCall, BarChart3, MessageSquare, Map as MapIcon,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";
import { BossAccessGuard } from "@/components/boss/BossAccessGuard";
import { BossShell } from "@/components/boss/BossShell";
import { useBossAuditLog } from "@/hooks/useBossJobOverrides";
import { useBossStaffList } from "@/hooks/useBossStaffManagement";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/boss/overview")({
  head: () => ({ meta: [{ title: "Boss Command · OCS" }] }),
  component: BossOverviewPage,
});

interface ActionCardProps {
  to: string;
  label: string;
  value: number | string;
  hint?: string;
  icon: LucideIcon;
  tone?: "default" | "warn" | "danger" | "ok";
}

function ActionCard({ to, label, value, hint, icon: Icon, tone = "default" }: ActionCardProps) {
  const toneRing =
    tone === "danger" ? "ring-destructive/30 hover:ring-destructive/60"
    : tone === "warn" ? "ring-amber-500/30 hover:ring-amber-500/60"
    : tone === "ok" ? "ring-emerald-500/30 hover:ring-emerald-500/60"
    : "ring-border hover:ring-primary/60";
  const toneText =
    tone === "danger" ? "text-destructive"
    : tone === "warn" ? "text-amber-600"
    : tone === "ok" ? "text-emerald-600"
    : "text-foreground";
  return (
    <Link
      to={to}
      className={`group flex flex-col rounded-lg border border-border bg-card p-5 ring-1 ring-inset transition-all hover:bg-accent/30 ${toneRing}`}
    >
      <div className="flex items-center justify-between">
        <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {label}
        </div>
        <Icon className="h-5 w-5 text-muted-foreground group-hover:text-foreground" />
      </div>
      <div className={`mt-2 text-[34px] font-semibold leading-none tracking-tight ${toneText}`}>{value}</div>
      {hint && <div className="mt-2 text-[13px] text-muted-foreground">{hint}</div>}
    </Link>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-8">
      <h2 className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
        {title}
      </h2>
      {children}
    </section>
  );
}

function QuickLink({ to, label, icon: Icon }: { to: string; label: string; icon: LucideIcon }) {
  return (
    <Link
      to={to}
      className="flex items-center gap-2.5 rounded-md border border-border bg-card px-4 py-3 text-[15px] font-medium text-foreground transition-colors hover:bg-accent"
    >
      <Icon className="h-[18px] w-[18px] text-muted-foreground" />
      {label}
    </Link>
  );
}

function useCompanyMailbox() {
  return useQuery({
    queryKey: ["boss", "overview", "mailbox"],
    queryFn: async () => {
      const { data } = await supabase
        .from("company_settings")
        .select("work_email")
        .maybeSingle();
      return data?.work_email ?? null;
    },
  });
}

type StaffFilter = "all" | "active" | "disabled";
type JumpFilter = "all" | "operations" | "platform" | "comms";

interface QuickJump {
  to: string;
  label: string;
  icon: LucideIcon;
  group: Exclude<JumpFilter, "all">;
}

const QUICK_JUMPS: QuickJump[] = [
  { to: "/admin", label: "Dispatcher dashboard", icon: ClipboardList, group: "operations" },
  { to: "/admin/diary", label: "Diary", icon: Activity, group: "operations" },
  { to: "/admin/map", label: "Map view", icon: MapIcon, group: "operations" },
  { to: "/admin/ops", label: "Ops & QA", icon: Activity, group: "operations" },
  { to: "/boss/ops", label: "Boss job overrides & audit", icon: ShieldCheck, group: "platform" },
  { to: "/boss/infrastructure", label: "Platform settings", icon: ShieldCheck, group: "platform" },
  { to: "/messages", label: "Messages", icon: MessageSquare, group: "comms" },
  { to: "/contacts", label: "Contacts", icon: Users, group: "comms" },
];

function BossOverviewPage() {
  const { data: staff = [] } = useBossStaffList();
  const { data: mailbox } = useCompanyMailbox();

  const [staffFilter, setStaffFilter] = useState<StaffFilter>("all");
  const [jumpFilter, setJumpFilter] = useState<JumpFilter>("all");
  const [auditExpanded, setAuditExpanded] = useState(false);
  const { data: audit = [] } = useBossAuditLog(auditExpanded ? 25 : 8);

  const filteredStaff = useMemo(() => {
    if (staffFilter === "active") return staff.filter((s) => s.is_active);
    if (staffFilter === "disabled") return staff.filter((s) => !s.is_active);
    return staff;
  }, [staff, staffFilter]);

  const engineers = filteredStaff.filter((s) => s.role === "engineer");
  const dispatchers = filteredStaff.filter((s) => s.role === "dispatcher");
  const disabledCount = staff.filter((s) => !s.is_active).length;

  const filteredJumps = useMemo(
    () => (jumpFilter === "all" ? QUICK_JUMPS : QUICK_JUMPS.filter((j) => j.group === jumpFilter)),
    [jumpFilter],
  );

  return (
    <BossAccessGuard>
      <BossShell>
        <header className="mb-7">
          <h1 className="text-4xl font-semibold tracking-tight text-foreground">Boss command</h1>
          <p className="mt-2 text-base text-muted-foreground">
            Platform-level controls. Day-to-day operational queues live on the{" "}
            <Link to="/admin" className="font-medium text-primary underline-offset-4 hover:underline">
              dispatcher dashboard
            </Link>
            .
          </p>
        </header>

        <Section
          title="People & engineers"
          right={
            <Toggle
              options={[
                { value: "all", label: `All (${staff.length})` },
                { value: "active", label: `Active (${staff.length - disabledCount})` },
                { value: "disabled", label: `Disabled (${disabledCount})` },
              ]}
              value={staffFilter}
              onChange={(v) => setStaffFilter(v as StaffFilter)}
            />
          }
        >
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <ActionCard
              to="/boss/members" label="Engineers" value={engineers.length}
              hint="Edit skills, certs, suitability" icon={Wrench}
            />
            <ActionCard
              to="/boss/members" label="Dispatchers" value={dispatchers.length}
              hint="Manage operational staff" icon={Users}
            />
            <ActionCard
              to="/boss/members" label="Total staff" value={filteredStaff.length}
              hint={staffFilter === "all" ? `${disabledCount} disabled` : `Filtered: ${staffFilter}`}
              icon={Users}
            />
            <ActionCard
              to="/admin/engineers" label="Engineer roster" value="Manage"
              hint="Live dispatch view" icon={Wrench}
            />
          </div>
        </Section>

        <Section title="Platform & integrations">
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <ActionCard
              to="/boss/infrastructure" label="Linked mailbox" value={mailbox ? "Set" : "Not set"}
              hint={mailbox ?? "Configure company work email"} icon={Mail}
              tone={mailbox ? "ok" : "warn"}
            />
            <ActionCard
              to="/admin/billing" label="Billing prep" value="Open"
              hint="Review cases before invoicing" icon={Receipt}
            />
            <ActionCard
              to="/admin/communications" label="Follow-ups" value="Open"
              hint="Outstanding comms" icon={PhoneCall}
            />
            <ActionCard
              to="/admin/reports" label="Reports" value="Open"
              hint="System, ops, intake, engineers" icon={BarChart3}
            />
          </div>
        </Section>

        <Section
          title="Quick jump"
          right={
            <Toggle
              options={[
                { value: "all", label: "All" },
                { value: "operations", label: "Operations" },
                { value: "platform", label: "Platform" },
                { value: "comms", label: "Comms" },
              ]}
              value={jumpFilter}
              onChange={(v) => setJumpFilter(v as JumpFilter)}
            />
          }
        >
          <div className="grid grid-cols-2 gap-2.5 md:grid-cols-4">
            {filteredJumps.map((j) => (
              <QuickLink key={j.to} to={j.to} label={j.label} icon={j.icon} />
            ))}
            {filteredJumps.length === 0 && (
              <p className="col-span-full text-sm text-muted-foreground">
                No shortcuts in this group.
              </p>
            )}
          </div>
        </Section>

        <Section
          title="Recent boss actions"
          right={
            <button
              type="button"
              onClick={() => setAuditExpanded((v) => !v)}
              className="rounded-md border border-border bg-card px-2.5 py-1 text-xs font-medium text-muted-foreground hover:bg-accent"
            >
              {auditExpanded ? "Show recent" : "Show more"}
            </button>
          }
        >
          {audit.length ? (
            <ul className="space-y-2 text-[15px]">
              {audit.map((a) => (
                <li key={a.id} className="rounded-md border border-border bg-card px-4 py-3">
                  <span className="font-medium">{a.action_type}</span>
                  <span className="text-muted-foreground"> · {new Date(a.created_at).toLocaleString()}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-[15px] text-muted-foreground">No actions yet.</p>
          )}
        </Section>
      </BossShell>
    </BossAccessGuard>
  );
}

function Toggle({
  options,
  value,
  onChange,
}: {
  options: { value: string; label: string }[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="inline-flex rounded-md border border-border bg-card p-0.5">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={cn(
            "rounded-sm px-2.5 py-1 text-xs font-medium transition-colors",
            value === o.value
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:bg-accent hover:text-foreground",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}