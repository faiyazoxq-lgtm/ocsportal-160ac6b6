import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  ClipboardList, Users, Wrench, Activity, Mail, ShieldCheck,
  Receipt, PhoneCall, BarChart3, MessageSquare, Map as MapIcon,
  Crown, Radio, ArrowUpRight, AlertTriangle, AlertOctagon,
  CheckSquare, Inbox, Gauge, Trash2, Loader2, Cpu, Siren,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { BossAccessGuard } from "@/components/boss/BossAccessGuard";
import { BossShell } from "@/components/boss/BossShell";
import { useBossAuditLog } from "@/hooks/useBossJobOverrides";
import { useBossStaffList } from "@/hooks/useBossStaffManagement";
import { useNavBadgeCounts } from "@/hooks/useNavBadgeCounts";
import { bossClearAuditLog } from "@/lib/boss.functions";
import { BOSS_ACTION_LABEL } from "@/types/boss";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader,
  AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export const Route = createFileRoute("/boss/overview")({
  head: () => ({ meta: [{ title: "Boss Overview · OCS" }] }),
  component: BossOverviewPage,
});

type Severity = "ok" | "default" | "warn" | "danger" | "critical";

const SEVERITY_STYLES: Record<Severity, {
  ring: string; text: string; iconWrap: string; bar: string; chip: string;
}> = {
  ok:       { ring: "ring-emerald-500/35",  text: "text-emerald-700",  iconWrap: "bg-emerald-500/10 text-emerald-600",  bar: "from-emerald-500 to-emerald-400",    chip: "bg-emerald-500/10 text-emerald-700 border-emerald-500/30" },
  default:  { ring: "ring-border",          text: "text-foreground",   iconWrap: "bg-primary/10 text-primary",          bar: "from-primary to-accent",             chip: "bg-muted text-muted-foreground border-border" },
  warn:     { ring: "ring-amber-500/40",    text: "text-amber-700",    iconWrap: "bg-amber-500/10 text-amber-600",      bar: "from-amber-500 to-amber-400",        chip: "bg-amber-500/10 text-amber-700 border-amber-500/30" },
  danger:   { ring: "ring-destructive/45",  text: "text-destructive",  iconWrap: "bg-destructive/10 text-destructive",  bar: "from-destructive to-amber-500",      chip: "bg-destructive/10 text-destructive border-destructive/30" },
  critical: { ring: "ring-destructive/60",  text: "text-destructive",  iconWrap: "bg-destructive/15 text-destructive",  bar: "from-destructive to-destructive/70", chip: "bg-destructive/15 text-destructive border-destructive/50" },
};

interface ActionCardProps {
  to: string;
  label: string;
  value: number | string;
  hint?: string;
  icon: LucideIcon;
  tone?: Severity;
  cta?: string;
}

function ActionCard({ to, label, value, hint, icon: Icon, tone = "default", cta }: ActionCardProps) {
  const s = SEVERITY_STYLES[tone];
  const urgent = tone === "danger" || tone === "critical";
  return (
    <Link
      to={to}
      className={cn(
        "group relative flex flex-col overflow-hidden rounded-xl border border-border bg-card p-5 ring-1 ring-inset transition-all duration-200",
        "hover:-translate-y-0.5 hover:shadow-lg hover:shadow-primary/10",
        s.ring,
      )}
    >
      <span className={cn("absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r opacity-90", s.bar)} />
      {urgent && (
        <span className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-destructive/15 blur-3xl" />
      )}
      <div className="relative flex items-center justify-between">
        <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
          {label}
        </div>
        <div className={cn("flex h-8 w-8 items-center justify-center rounded-lg", s.iconWrap)}>
          <Icon className="h-4 w-4" />
        </div>
      </div>
      <div className={cn("relative mt-3 font-display text-[40px] font-bold leading-none tracking-tight tabular-nums", s.text)}>
        {value}
      </div>
      {hint && <div className="relative mt-2 text-[13px] leading-snug text-muted-foreground">{hint}</div>}
      {cta && (
        <div className={cn(
          "relative mt-3 inline-flex items-center gap-1 self-start rounded-md border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider",
          s.chip,
        )}>
          {cta} <ArrowUpRight className="h-3 w-3" />
        </div>
      )}
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

function QuickLink({ to, label, reason, icon: Icon }: { to: string; label: string; reason: string; icon: LucideIcon }) {
  return (
    <Link
      to={to}
      className="group flex items-center justify-between gap-3 rounded-lg border border-border bg-card px-4 py-3 transition-all hover:-translate-y-0.5 hover:border-primary/50 hover:bg-accent/30 hover:shadow-md hover:shadow-primary/5"
    >
      <span className="flex min-w-0 items-center gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary/8 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
          <Icon className="h-[18px] w-[18px]" />
        </span>
        <span className="min-w-0">
          <span className="block truncate text-[15px] font-semibold text-foreground">{label}</span>
          <span className="block truncate text-[12px] text-muted-foreground">{reason}</span>
        </span>
      </span>
      <ArrowUpRight className="h-4 w-4 shrink-0 text-muted-foreground/40 transition-all group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-primary" />
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
  reason: string;
  icon: LucideIcon;
  group: Exclude<JumpFilter, "all">;
}

const QUICK_JUMPS: QuickJump[] = [
  { to: "/admin",                label: "Dispatcher dashboard", reason: "Open today's live queues",     icon: ClipboardList, group: "operations" },
  { to: "/admin/diary",          label: "Diary",                reason: "Plan and rebalance the week",  icon: Activity,      group: "operations" },
  { to: "/admin/map",            label: "Map view",             reason: "See engineer positions",       icon: MapIcon,       group: "operations" },
  { to: "/admin/ops",            label: "Ops & QA",             reason: "Quality and process checks",   icon: Activity,      group: "operations" },
  { to: "/boss/ops",             label: "Boss overrides",       reason: "Force status / re-assign",     icon: ShieldCheck,   group: "platform"   },
  { to: "/boss/infrastructure",  label: "Platform settings",    reason: "Mailbox, sync, integrations",  icon: ShieldCheck,   group: "platform"   },
  { to: "/messages",             label: "Messages",             reason: "Direct conversations",         icon: MessageSquare, group: "comms"      },
  { to: "/contacts",             label: "Contacts",             reason: "Client & contact directory",   icon: Users,         group: "comms"      },
];

const AUDIT_SEVERITY: Record<string, Severity> = {
  status_overridden: "critical",
  record_force_unlocked: "critical",
  account_disabled: "danger",
  account_deleted: "danger",
  audit_log_cleared: "danger",
  role_changed: "danger",
  engineer_deleted: "danger",
  assignment_overridden: "warn",
  job_reopened: "warn",
  job_edited: "warn",
  password_reset_initiated: "warn",
  temp_password_set: "warn",
  engineer_archived: "warn",
  profile_edited: "default",
  external_contact_deleted: "default",
  account_created: "ok",
  account_reactivated: "ok",
};
function severityOf(t: string): Severity { return AUDIT_SEVERITY[t] ?? "default"; }

function relTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.round(diff / 60_000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  return `${d}d ago`;
}

function BossOverviewPage() {
  const { data: staff = [] } = useBossStaffList();
  const { data: mailbox } = useCompanyMailbox();
  const badges = useNavBadgeCounts();
  const qc = useQueryClient();

  const [staffFilter, setStaffFilter] = useState<StaffFilter>("all");
  const [jumpFilter, setJumpFilter] = useState<JumpFilter>("all");
  const [auditExpanded, setAuditExpanded] = useState(false);
  const { data: audit = [] } = useBossAuditLog(auditExpanded ? 50 : 10);

  const filteredStaff = useMemo(() => {
    if (staffFilter === "active") return staff.filter((s) => s.is_active);
    if (staffFilter === "disabled") return staff.filter((s) => !s.is_active);
    return staff;
  }, [staff, staffFilter]);

  const engineers = filteredStaff.filter((s) => s.role === "engineer");
  const dispatchers = filteredStaff.filter((s) => s.role === "dispatcher");
  const disabledCount = staff.filter((s) => !s.is_active).length;
  const activeCount = staff.length - disabledCount;
  const activeEngineers = staff.filter((s) => s.role === "engineer" && s.is_active).length;
  const totalEngineers = staff.filter((s) => s.role === "engineer").length;

  const attentionCount = badges["/admin/attention"] ?? 0;
  const reviewCount = badges["/admin/review"] ?? 0;
  const followUpCount = badges["/admin/communications"] ?? 0;
  const messageCount = badges["/messages"] ?? 0;
  const intakeCount = badges["/admin/intake"] ?? 0;

  const attentionSev: Severity = attentionCount === 0 ? "ok" : attentionCount >= 5 ? "critical" : attentionCount >= 2 ? "danger" : "warn";
  const intakeSev: Severity    = intakeCount    === 0 ? "ok" : intakeCount    >= 5 ? "critical" : intakeCount   >= 1 ? "danger" : "warn";
  const reviewSev: Severity    = reviewCount    === 0 ? "ok" : reviewCount    >= 10 ? "danger" : reviewCount   >= 3 ? "warn" : "default";
  const followSev: Severity    = followUpCount  === 0 ? "ok" : followUpCount  >= 10 ? "danger" : followUpCount >= 3 ? "warn" : "default";
  const engineerSev: Severity  = totalEngineers === 0 ? "warn" : activeEngineers === 0 ? "critical" : activeEngineers < totalEngineers ? "warn" : "ok";
  const mailboxSev: Severity   = mailbox ? "ok" : "warn";

  const pressureTotal = attentionCount + reviewCount + followUpCount;
  const sevs: Severity[] = [attentionSev, reviewSev, followSev, engineerSev, mailboxSev];
  const overallPosture: Severity =
    sevs.includes("critical") ? "critical"
    : sevs.includes("danger") ? "danger"
    : sevs.includes("warn") ? "warn"
    : "ok";
  const postureCopy: Record<Severity, { label: string; tone: string }> = {
    ok:       { label: "All clear",         tone: "Systems calm. No boss intervention required." },
    default:  { label: "Stable",            tone: "Operations running normally." },
    warn:     { label: "Pressure rising",   tone: "Multiple queues are accumulating. Review below." },
    danger:   { label: "Attention needed",  tone: "Operational pressure detected. Intervene where flagged." },
    critical: { label: "Critical",          tone: "Urgent boss intervention required on flagged surfaces." },
  };

  const filteredJumps = useMemo(
    () => (jumpFilter === "all" ? QUICK_JUMPS : QUICK_JUMPS.filter((j) => j.group === jumpFilter)),
    [jumpFilter],
  );

  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(id);
  }, []);

  const clearAuditFn = useServerFn(bossClearAuditLog);
  const clearAudit = useMutation({
    mutationFn: () => clearAuditFn({ data: { reason: "Boss-initiated audit log clear" } }),
    onSuccess: (res) => {
      toast.success(`Cleared ${res?.cleared ?? 0} entries`);
      qc.invalidateQueries({ queryKey: ["boss", "audit"] });
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Failed to clear audit log"),
  });

  return (
    <BossAccessGuard>
      <BossShell>
        {/* ============ COMMAND HERO ============ */}
        <header className="surface-glow surface-glow-strong mb-5 p-6 md:p-7">
          <div className="pointer-events-none absolute -bottom-24 -left-16 h-64 w-64 rounded-full bg-primary/15 blur-3xl" />
          <div className="relative flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
            <div className="min-w-0">
              <span className="glow-badge mb-3">
                <Crown className="h-3.5 w-3.5" />
                Boss Overview · Command Center
              </span>
              <h1 className="font-display text-4xl font-bold leading-[1.05] tracking-tight text-foreground md:text-5xl">
                Boss Overview
              </h1>
              <p className="mt-3 flex flex-wrap items-center gap-2 text-[15px] leading-relaxed text-muted-foreground">
                <PostureBadge sev={overallPosture} label={postureCopy[overallPosture].label} />
                <span>{postureCopy[overallPosture].tone}</span>
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2.5">
              <StatusPill
                icon={<span className="relative flex h-2 w-2"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-75" /><span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" /></span>}
                label="System" value="Live"
              />
              <StatusPill icon={<Radio className="h-3.5 w-3.5 text-primary" />} label="Engineers" value={`${activeEngineers}/${totalEngineers}`} />
              <StatusPill icon={<Gauge className="h-3.5 w-3.5 text-accent" />} label="Pressure" value={pressureTotal.toString()} />
              <StatusPill icon={<Cpu className="h-3.5 w-3.5 text-muted-foreground" />} label="Now" value={now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} />
            </div>
          </div>

          {/* Command strip — six high-signal posture readouts */}
          <div className="relative mt-6 grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-6">
            <CommandStat to="/admin/intake" label="Intake queue" value={intakeCount} sev={intakeSev} icon={Inbox} />
            <CommandStat to="/admin/attention" label="Attention" value={attentionCount} sev={attentionSev} icon={Siren} />
            <CommandStat to="/admin/review"    label="Review queue" value={reviewCount} sev={reviewSev} icon={CheckSquare} />
            <CommandStat to="/admin/communications" label="Follow-ups" value={followUpCount} sev={followSev} icon={PhoneCall} />
            <CommandStat to="/messages"        label="Unread DMs" value={messageCount} sev={messageCount > 0 ? "warn" : "ok"} icon={MessageSquare} />
            <CommandStat to="/admin/engineers" label="Engineers on" value={`${activeEngineers}/${totalEngineers}`} sev={engineerSev} icon={Wrench} />
            <CommandStat to="/boss/infrastructure" label="Mailbox" value={mailbox ? "Set" : "Off"} sev={mailboxSev} icon={Mail} />
          </div>
        </header>

        {/* ============ PRESSURE & INTERVENTIONS ============ */}
        <Section
          title="Pressure & interventions"
          right={
            <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              <AlertTriangle className="h-3.5 w-3.5 text-amber-500" /> Act here first
            </span>
          }
        >
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
            <ActionCard
              to="/admin/intake" label="Intake queue" value={intakeCount}
              hint={intakeCount === 0 ? "No new emails waiting. Inbox is clear." : "New jobs from email — contact the customer to fill any missing details."}
              icon={Inbox} tone={intakeSev}
              cta={intakeCount === 0 ? "Clear" : "Triage now"}
            />
            <ActionCard
              to="/admin/attention" label="Boss attention" value={attentionCount}
              hint={attentionCount === 0 ? "No work orders need boss intervention." : "Work orders in attention statuses awaiting boss action."}
              icon={Siren} tone={attentionSev}
              cta={attentionCount === 0 ? "Clear" : "Intervene"}
            />
            <ActionCard
              to="/admin/review" label="Review queue" value={reviewCount}
              hint={reviewCount === 0 ? "Intake parsing fully resolved." : "Parsing reviews awaiting decision."}
              icon={CheckSquare} tone={reviewSev}
              cta={reviewCount === 0 ? "Healthy" : "Review"}
            />
            <ActionCard
              to="/admin/communications" label="Follow-ups" value={followUpCount}
              hint={followUpCount === 0 ? "All comms closed out." : "Outstanding callbacks and follow-ups."}
              icon={PhoneCall} tone={followSev}
              cta={followUpCount === 0 ? "Clear" : "Resolve"}
            />
          </div>
        </Section>

        {/* ============ WORKFORCE ============ */}
        <Section
          title="Workforce posture"
          right={
            <Toggle
              options={[
                { value: "all", label: `All (${staff.length})` },
                { value: "active", label: `Active (${activeCount})` },
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
              hint={`${activeEngineers}/${totalEngineers} active in workforce`}
              icon={Wrench} tone={engineerSev}
            />
            <ActionCard
              to="/boss/members" label="Dispatchers" value={dispatchers.length}
              hint="Operational coordinators" icon={Users}
            />
            <ActionCard
              to="/boss/members" label="Total staff" value={filteredStaff.length}
              hint={staffFilter === "all" ? `${disabledCount} disabled` : `Filter: ${staffFilter}`}
              icon={Users} tone={disabledCount > 0 ? "warn" : "default"}
            />
            <ActionCard
              to="/admin/engineers" label="Live roster" value="Open"
              hint="Dispatch-facing engineer state" icon={Radio} cta="Open"
            />
          </div>
        </Section>

        {/* ============ PLATFORM CONTROLS ============ */}
        <Section
          title="Platform-wide controls"
          right={
            <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              <ShieldCheck className="h-3.5 w-3.5 text-primary" /> Boss-only
            </span>
          }
        >
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <ActionCard
              to="/boss/infrastructure" label="Linked mailbox"
              value={mailbox ? "Set" : "Not set"}
              hint={mailbox ?? "Configure the company inbox sync"}
              icon={Mail} tone={mailboxSev}
              cta={mailbox ? "Manage" : "Configure"}
            />
            <ActionCard
              to="/admin/billing" label="Billing prep" value="Open"
              hint="Sign-off jobs before invoicing" icon={Receipt} cta="Review"
            />
            <ActionCard
              to="/boss/ops" label="Overrides & audit" value="Open"
              hint="Force status, unlock, re-assign" icon={ShieldCheck} cta="Intervene"
            />
            <ActionCard
              to="/admin/reports" label="Reports" value="Open"
              hint="Ops, intake, engineers, billing" icon={BarChart3} cta="Analyze"
            />
          </div>
        </Section>

        {/* ============ LAUNCH BAY ============ */}
        <Section
          title="Launch bay"
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
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
            {filteredJumps.map((j) => (
              <QuickLink key={j.to} to={j.to} label={j.label} reason={j.reason} icon={j.icon} />
            ))}
            {filteredJumps.length === 0 && (
              <p className="col-span-full text-sm text-muted-foreground">No shortcuts in this group.</p>
            )}
          </div>
        </Section>

        {/* ============ AUDIT / SIGNAL FEED ============ */}
        <Section
          title="Boss action feed"
          right={
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setAuditExpanded((v) => !v)}
                className="rounded-md border border-border bg-card px-3 py-1 text-xs font-medium text-muted-foreground transition-colors hover:border-primary/40 hover:bg-accent hover:text-foreground"
              >
                {auditExpanded ? "Show recent" : "Show more"}
              </button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <button
                    type="button"
                    disabled={audit.length === 0 || clearAudit.isPending}
                    className="inline-flex items-center gap-1.5 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-1 text-xs font-semibold text-destructive transition-colors hover:bg-destructive/10 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {clearAudit.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                    Clear log
                  </button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle className="flex items-center gap-2">
                      <AlertOctagon className="h-5 w-5 text-destructive" /> Clear boss action log?
                    </AlertDialogTitle>
                    <AlertDialogDescription>
                      This permanently deletes every entry from the boss audit log. The clear itself
                      will be recorded as a new audit entry. This cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => clearAudit.mutate()}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      Clear permanently
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          }
        >
          {audit.length ? (
            <ul className="overflow-hidden rounded-xl border border-border bg-card">
              {audit.map((a, i) => {
                const sev = severityOf(a.action_type);
                const s = SEVERITY_STYLES[sev];
                const label = BOSS_ACTION_LABEL[a.action_type] ?? a.action_type.replace(/_/g, " ");
                return (
                  <li
                    key={a.id}
                    className={cn(
                      "group flex items-center gap-3 px-4 py-3 transition-colors hover:bg-accent/30",
                      i > 0 && "border-t border-border",
                    )}
                  >
                    <span className={cn("flex h-7 w-7 shrink-0 items-center justify-center rounded-md", s.iconWrap)}>
                      {sev === "critical" || sev === "danger"
                        ? <AlertOctagon className="h-3.5 w-3.5" />
                        : sev === "warn"
                          ? <AlertTriangle className="h-3.5 w-3.5" />
                          : sev === "ok"
                            ? <CheckSquare className="h-3.5 w-3.5" />
                            : <Inbox className="h-3.5 w-3.5" />}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold text-foreground">{label}</span>
                        <span className={cn("rounded border px-1.5 py-px text-[10px] font-bold uppercase tracking-wider", s.chip)}>
                          {sev === "critical" ? "Critical" : sev === "danger" ? "High" : sev === "warn" ? "Warn" : sev === "ok" ? "Routine" : "Info"}
                        </span>
                        {a.target_type && (
                          <span className="text-[11px] text-muted-foreground">on {a.target_type}</span>
                        )}
                      </div>
                      {a.reason && (
                        <div className="mt-0.5 truncate text-[13px] text-muted-foreground">{a.reason}</div>
                      )}
                    </div>
                    <div className="text-right text-xs tabular-nums text-muted-foreground">
                      <div>{relTime(a.created_at)}</div>
                      <div className="text-[10px] opacity-70">
                        {new Date(a.created_at).toLocaleString([], { hour: "2-digit", minute: "2-digit", month: "short", day: "numeric" })}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : (
            <div className="rounded-xl border border-dashed border-border bg-card/60 p-8 text-center">
              <CheckSquare className="mx-auto mb-2 h-6 w-6 text-emerald-600" />
              <p className="text-[15px] font-medium text-foreground">No boss actions on record</p>
              <p className="mt-1 text-[13px] text-muted-foreground">Overrides, role changes and other boss interventions will appear here.</p>
            </div>
          )}
        </Section>
      </BossShell>
    </BossAccessGuard>
  );
}

function StatusPill({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card/80 px-3 py-1.5 text-xs font-semibold backdrop-blur-sm">
      {icon}
      <span className="uppercase tracking-[0.14em] text-muted-foreground">{label}</span>
      <span className="tabular-nums text-foreground">{value}</span>
    </div>
  );
}

function PostureBadge({ sev, label }: { sev: Severity; label: string }) {
  const s = SEVERITY_STYLES[sev];
  const dot =
    sev === "ok" ? "bg-emerald-500"
    : sev === "warn" ? "bg-amber-500"
    : sev === "danger" || sev === "critical" ? "bg-destructive"
    : "bg-primary";
  return (
    <span className={cn(
      "inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-[11px] font-bold uppercase tracking-[0.14em]",
      s.chip,
    )}>
      <span className={cn("h-1.5 w-1.5 rounded-full", dot, (sev === "danger" || sev === "critical") && "animate-pulse")} />
      {label}
    </span>
  );
}

function CommandStat({
  to, label, value, sev, icon: Icon,
}: { to: string; label: string; value: number | string; sev: Severity; icon: LucideIcon }) {
  const s = SEVERITY_STYLES[sev];
  return (
    <Link
      to={to}
      className={cn(
        "group relative flex items-center gap-3 overflow-hidden rounded-lg border border-border bg-card/80 px-3 py-2.5 backdrop-blur-sm transition-all hover:-translate-y-0.5 hover:shadow-md",
        "ring-1 ring-inset", s.ring,
      )}
    >
      <span className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-md", s.iconWrap)}>
        <Icon className="h-4 w-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">{label}</span>
        <span className={cn("block truncate font-display text-lg font-bold leading-tight tabular-nums", s.text)}>{value}</span>
      </span>
      {(sev === "danger" || sev === "critical") && (
        <span className="absolute right-2 top-2 h-1.5 w-1.5 animate-pulse rounded-full bg-destructive" />
      )}
    </Link>
  );
}

function Toggle({
  options, value, onChange,
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
            "rounded-md px-2.5 py-1 text-xs font-semibold transition-all",
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
