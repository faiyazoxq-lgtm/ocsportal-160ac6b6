import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  ClipboardList, Users, Wrench, Activity, Mail, ShieldCheck,
  Receipt, PhoneCall, BarChart3, MessageSquare, Map as MapIcon,
  Crown, Zap, Radio, ArrowUpRight, Sparkles,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";
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
  const toneAccent =
    tone === "danger" ? "from-destructive/25 via-destructive/5 ring-destructive/40"
    : tone === "warn" ? "from-amber-500/25 via-amber-500/5 ring-amber-500/40"
    : tone === "ok" ? "from-emerald-500/25 via-emerald-500/5 ring-emerald-500/40"
    : "from-primary/20 via-primary/5 ring-border";
  const toneText =
    tone === "danger" ? "text-destructive"
    : tone === "warn" ? "text-amber-600"
    : tone === "ok" ? "text-emerald-600"
    : "text-foreground";
  const iconWrap =
    tone === "danger" ? "bg-destructive/10 text-destructive"
    : tone === "warn" ? "bg-amber-500/10 text-amber-600"
    : tone === "ok" ? "bg-emerald-500/10 text-emerald-600"
    : "bg-primary/10 text-primary";
  return (
    <Link
      to={to}
      className={cn(
        "group relative flex flex-col overflow-hidden rounded-xl border border-border bg-card p-5 ring-1 ring-inset transition-all duration-200",
        "hover:-translate-y-0.5 hover:shadow-lg hover:shadow-primary/10 hover:ring-primary/40",
        toneAccent,
      )}
    >
      <div
        className={cn(
          "pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-gradient-to-br to-transparent opacity-60 blur-2xl transition-opacity group-hover:opacity-100",
          toneAccent,
        )}
      />
      <div className="relative flex items-center justify-between">
        <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
          {label}
        </div>
        <div className={cn("flex h-8 w-8 items-center justify-center rounded-lg", iconWrap)}>
          <Icon className="h-4 w-4" />
        </div>
      </div>
      <div className={cn("relative mt-3 text-[36px] font-bold leading-none tracking-tight", toneText)}>
        {value}
      </div>
      {hint && <div className="relative mt-2 text-[13px] text-muted-foreground">{hint}</div>}
      <ArrowUpRight className="absolute bottom-3 right-3 h-4 w-4 text-muted-foreground/40 opacity-0 transition-all group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:opacity-100" />
    </Link>
  );
}

function Section({ title, children, right }: { title: string; children: ReactNode; right?: ReactNode }) {
  return (
    <section className="mt-8">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="h-3 w-0.5 rounded-full bg-gradient-to-b from-primary to-accent" />
          <h2 className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            {title}
          </h2>
        </div>
        {right}
      </div>
      {children}
    </section>
  );
}

function QuickLink({ to, label, icon: Icon }: { to: string; label: string; icon: LucideIcon }) {
  return (
    <Link
      to={to}
      className="group flex items-center justify-between gap-2.5 rounded-lg border border-border bg-card px-4 py-3 text-[15px] font-medium text-foreground transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:bg-accent/40 hover:shadow-md hover:shadow-primary/5"
    >
      <span className="flex items-center gap-2.5">
        <Icon className="h-[18px] w-[18px] text-muted-foreground transition-colors group-hover:text-primary" />
        {label}
      </span>
      <ArrowUpRight className="h-4 w-4 text-muted-foreground/30 transition-all group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-primary" />
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
  const activeCount = staff.length - disabledCount;

  const filteredJumps = useMemo(
    () => (jumpFilter === "all" ? QUICK_JUMPS : QUICK_JUMPS.filter((j) => j.group === jumpFilter)),
    [jumpFilter],
  );

  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(id);
  }, []);

  return (
    <BossAccessGuard>
      <BossShell>
        <header className="relative mb-8 overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-primary/15 via-card to-accent/10 p-7 shadow-xl shadow-primary/5">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_color-mix(in_oklab,var(--accent)_18%,transparent),_transparent_55%)]" />
          <div className="pointer-events-none absolute -bottom-24 -left-16 h-64 w-64 rounded-full bg-primary/15 blur-3xl" />
          <div className="relative flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">
                <Crown className="h-3.5 w-3.5" />
                Command Center
              </div>
              <h1 className="text-4xl font-bold tracking-tight text-foreground md:text-5xl">
                Boss command
              </h1>
              <p className="mt-2 max-w-2xl text-base text-muted-foreground">
                Ultimate platform controls. Day-to-day operational queues live on the{" "}
                <Link to="/admin" className="font-medium text-primary underline-offset-4 hover:underline">
                  dispatcher dashboard
                </Link>
                .
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2.5">
              <StatusPill
                icon={<span className="relative flex h-2 w-2"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-75" /><span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" /></span>}
                label="System"
                value="Live"
              />
              <StatusPill icon={<Radio className="h-3.5 w-3.5 text-primary" />} label="Active" value={`${activeCount}/${staff.length}`} />
              <StatusPill icon={<Sparkles className="h-3.5 w-3.5 text-accent" />} label="Now" value={now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} />
            </div>
          </div>
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

        <Section
          title="Platform & integrations"
          right={
            <span className="inline-flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              <Zap className="h-3.5 w-3.5 text-amber-500" /> Power controls
            </span>
          }
        >
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
              className="rounded-md border border-border bg-card px-3 py-1 text-xs font-medium text-muted-foreground transition-colors hover:border-primary/40 hover:bg-accent hover:text-foreground"
            >
              {auditExpanded ? "Show recent" : "Show more"}
            </button>
          }
        >
          {audit.length ? (
            <ul className="space-y-1.5 text-[15px]">
              {audit.map((a) => (
                <li
                  key={a.id}
                  className="group flex items-center gap-3 rounded-lg border border-border bg-card px-4 py-3 transition-colors hover:border-primary/30 hover:bg-accent/30"
                >
                  <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary/60 group-hover:bg-primary" />
                  <span className="font-medium tabular-nums">{a.action_type}</span>
                  <span className="ml-auto text-xs tabular-nums text-muted-foreground">
                    {new Date(a.created_at).toLocaleString()}
                  </span>
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

function StatusPill({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card/80 px-3 py-1.5 text-xs font-medium backdrop-blur-sm">
      {icon}
      <span className="uppercase tracking-wider text-muted-foreground">{label}</span>
      <span className="font-semibold tabular-nums text-foreground">{value}</span>
    </div>
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
    <div className="inline-flex rounded-lg border border-border bg-card p-0.5 shadow-sm">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={cn(
            "rounded-md px-2.5 py-1 text-xs font-medium transition-all",
            value === o.value
              ? "bg-gradient-to-b from-primary to-primary/90 text-primary-foreground shadow-sm"
              : "text-muted-foreground hover:bg-accent hover:text-foreground",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}