import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  Inbox,
  AlertTriangle,
  ClipboardList,
  CheckSquare,
  Briefcase,
  ShieldCheck,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { useBossAllWorkOrders } from "@/hooks/useBossJobOverrides";
import { supabase } from "@/integrations/supabase/client";

interface ActionCardProps {
  to: string;
  search?: Record<string, unknown>;
  label: string;
  value: number | string;
  hint?: string;
  icon: LucideIcon;
  tone?: "default" | "warn" | "danger" | "ok";
}

function ActionCard({ to, search, label, value, hint, icon: Icon, tone = "default" }: ActionCardProps) {
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
      search={search as never}
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

function useIntakeReviewCount() {
  return useQuery({
    queryKey: ["dashboard", "intake_review"],
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
    queryKey: ["dashboard", "duplicates"],
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

/**
 * Shared operational queue cards used by the Boss command overview and the
 * Dispatcher dashboard so both roles see the same live counts and routes.
 */
export function OperationalQueueCards() {
  const { data: jobs = [] } = useBossAllWorkOrders();
  const { data: intakeReview = 0 } = useIntakeReviewCount();
  const { data: duplicates = 0 } = useDuplicateReviewCount();

  const attention = jobs.filter((j) => j.current_status === "admin_attention").length;
  const ready = jobs.filter((j) => j.current_status === "ready_for_dispatch").length;
  const review = jobs.filter((j) =>
    ["dispatcher_review", "field_submitted_complete", "field_submitted_incomplete"].includes(j.current_status),
  ).length;
  const open = jobs.filter((j) => !["closed", "cancelled"].includes(j.current_status)).length;
  const urgent = jobs.filter((j) => j.priority_level === "urgent" && !["closed", "cancelled"].includes(j.current_status)).length;
  const fieldLocked = jobs.filter((j) => j.field_lock_active).length;

  return (
    <>
      <Section title="Triage queue — act first">
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <ActionCard
            to="/admin/intake" label="Intake to review" value={intakeReview}
            hint="New inbound from Company Gmail — verify & convert" icon={Inbox}
            tone={intakeReview > 0 ? "warn" : "default"}
          />
          <ActionCard
            to="/admin/intake" label="Possible duplicates" value={duplicates}
            hint="Likely repeats — confirm or dismiss before dispatch" icon={AlertTriangle}
            tone={duplicates > 0 ? "warn" : "default"}
          />
          <ActionCard
            to="/admin/attention" label="Admin attention" value={attention}
            hint="Engineer flagged for admin follow-up" icon={AlertTriangle}
            tone={attention > 0 ? "danger" : "default"}
          />
          <ActionCard
            to="/admin/review" label="Awaiting sign-off" value={review}
            hint="Field-submitted work orders pending dispatcher review" icon={CheckSquare}
            tone={review > 0 ? "warn" : "default"}
          />
        </div>
      </Section>

      <Section title="ALL WORK ORDERS">
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <ActionCard
            to="/admin/dispatch" search={{ queue: "ready" }} label="Ready to dispatch" value={ready}
            hint="Categorised — assign to an engineer" icon={ClipboardList}
            tone={ready > 0 ? "ok" : "default"}
          />
          <ActionCard
            to="/admin/dispatch" search={{ queue: "urgent" }} label="Urgent jobs" value={urgent}
            hint="Priority = urgent — prioritise scheduling" icon={AlertTriangle}
            tone={urgent > 0 ? "danger" : "default"}
          />
          <ActionCard
            to="/admin/dispatch" search={{ queue: "open" }} label="Open work orders" value={open}
            hint="Total live jobs across all engineers" icon={Briefcase}
          />
          <ActionCard
            to="/admin/dispatch" search={{ queue: "field_locked" }} label="Field-locked" value={fieldLocked}
            hint="Engineer holds active lock — boss override required" icon={ShieldCheck}
            tone={fieldLocked > 0 ? "warn" : "default"}
          />
        </div>
      </Section>
    </>
  );
}

export default OperationalQueueCards;