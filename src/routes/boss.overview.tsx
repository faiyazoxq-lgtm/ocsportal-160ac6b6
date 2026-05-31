import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  Inbox, AlertTriangle, ClipboardList, CheckSquare, Users, Wrench,
  Activity, Mail, ShieldCheck, Receipt, PhoneCall, BarChart3, Briefcase,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { BossAccessGuard } from "@/components/boss/BossAccessGuard";
import { BossShell } from "@/components/boss/BossShell";
import { useBossAllWorkOrders, useBossAuditLog } from "@/hooks/useBossJobOverrides";
import { useBossStaffList } from "@/hooks/useBossStaffManagement";
import { supabase } from "@/integrations/supabase/client";

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
        <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          {label}
        </div>
        <Icon className="h-[18px] w-[18px] text-muted-foreground group-hover:text-foreground" />
      </div>
      <div className={`mt-2 text-3xl font-semibold tracking-tight ${toneText}`}>{value}</div>
      {hint && <div className="mt-1.5 text-xs text-muted-foreground">{hint}</div>}
    </Link>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-8">
      <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
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
      className="flex items-center gap-2.5 rounded-md border border-border bg-card px-4 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-accent"
    >
      <Icon className="h-4 w-4 text-muted-foreground" />
      {label}
    </Link>
  );
}

function useIntakeReviewCount() {
  return useQuery({
    queryKey: ["boss", "overview", "intake_review"],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("intake_records")
        .select("id", { count: "exact", head: true })
        .in("parse_status", ["received", "needs_review"]);
      if (error) return 0;
      return count ?? 0;
    },
  });
}

function useDuplicateReviewCount() {
  return useQuery({
    queryKey: ["boss", "overview", "duplicates"],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("intake_records")
        .select("id", { count: "exact", head: true })
        .gte("duplicate_confidence", 0.7)
        .eq("duplicate_review_status", "open");
      if (error) return 0;
      return count ?? 0;
    },
  });
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

function BossOverviewPage() {
  const { data: jobs = [] } = useBossAllWorkOrders();
  const { data: staff = [] } = useBossStaffList();
  const { data: audit = [] } = useBossAuditLog(8);
  const { data: intakeReview = 0 } = useIntakeReviewCount();
  const { data: duplicates = 0 } = useDuplicateReviewCount();
  const { data: mailbox } = useCompanyMailbox();

  const attention = jobs.filter((j) => j.current_status === "admin_attention").length;
  const ready = jobs.filter((j) => j.current_status === "ready_for_dispatch").length;
  const review = jobs.filter((j) =>
    ["dispatcher_review", "field_submitted_complete", "field_submitted_incomplete"].includes(j.current_status),
  ).length;
  const open = jobs.filter((j) => !["closed", "cancelled"].includes(j.current_status)).length;
  const urgent = jobs.filter((j) => j.priority_level === "urgent" && !["closed", "cancelled"].includes(j.current_status)).length;
  const fieldLocked = jobs.filter((j) => j.field_lock_active).length;

  const engineers = staff.filter((s) => s.role === "engineer");
  const dispatchers = staff.filter((s) => s.role === "dispatcher");
  const disabledCount = staff.filter((s) => !s.is_active).length;

  return (
    <BossAccessGuard>
      <BossShell>
        <header className="mb-6">
          <h1 className="text-3xl font-semibold tracking-tight text-foreground">Boss command</h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Operational queues and platform controls. Click any card to act.
          </p>
        </header>

        <Section title="Needs attention now">
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <ActionCard
              to="/admin/intake" label="Intake to review" value={intakeReview}
              hint="Parsed inbound to triage" icon={Inbox}
              tone={intakeReview > 0 ? "warn" : "default"}
            />
            <ActionCard
              to="/admin/intake" label="Possible duplicates" value={duplicates}
              hint="Inbound flagged ≥70% match" icon={AlertTriangle}
              tone={duplicates > 0 ? "warn" : "default"}
            />
            <ActionCard
              to="/admin/attention" label="Admin attention" value={attention}
              hint="Jobs flagged for follow-up" icon={AlertTriangle}
              tone={attention > 0 ? "danger" : "default"}
            />
            <ActionCard
              to="/admin/review" label="Awaiting review" value={review}
              hint="Field-submitted, needs sign-off" icon={CheckSquare}
              tone={review > 0 ? "warn" : "default"}
            />
          </div>
        </Section>

        <Section title="Dispatch & work orders">
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <ActionCard
              to="/admin/dispatch" label="Ready to dispatch" value={ready}
              hint="Categorised, waiting on engineer" icon={ClipboardList}
              tone={ready > 0 ? "ok" : "default"}
            />
            <ActionCard
              to="/admin/dispatch" label="Urgent open" value={urgent}
              hint="Priority = urgent" icon={AlertTriangle}
              tone={urgent > 0 ? "danger" : "default"}
            />
            <ActionCard
              to="/boss/ops" label="Open work orders" value={open}
              hint="All statuses except closed/cancelled" icon={Briefcase}
            />
            <ActionCard
              to="/boss/ops" label="Field-locked jobs" value={fieldLocked}
              hint="Active engineer lock — boss can override" icon={ShieldCheck}
              tone={fieldLocked > 0 ? "warn" : "default"}
            />
          </div>
        </Section>

        <Section title="People & engineers">
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
              to="/boss/members" label="Total staff" value={staff.length}
              hint={`${disabledCount} disabled`} icon={Users}
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

        <Section title="Quick jump">
          <div className="grid grid-cols-2 gap-2.5 md:grid-cols-4">
            <QuickLink to="/admin" label="Dispatcher dashboard" icon={ClipboardList} />
            <QuickLink to="/admin/diary" label="Diary" icon={Activity} />
            <QuickLink to="/admin/map" label="Map view" icon={Activity} />
            <QuickLink to="/admin/ops" label="Ops & QA" icon={Activity} />
            <QuickLink to="/boss/ops" label="Boss job overrides & audit" icon={ShieldCheck} />
            <QuickLink to="/boss/infrastructure" label="Platform settings" icon={ShieldCheck} />
            <QuickLink to="/messages" label="Messages" icon={Activity} />
            <QuickLink to="/contacts" label="Contacts" icon={Users} />
          </div>
        </Section>

        <Section title="Recent boss actions">
          {audit.length ? (
            <ul className="space-y-2 text-sm">
              {audit.map((a) => (
                <li key={a.id} className="rounded-md border border-border bg-card px-4 py-2.5">
                  <span className="font-medium">{a.action_type}</span>
                  <span className="text-muted-foreground"> · {new Date(a.created_at).toLocaleString()}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">No actions yet.</p>
          )}
        </Section>
      </BossShell>
    </BossAccessGuard>
  );
}