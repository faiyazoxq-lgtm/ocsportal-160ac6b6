import { Link } from "@tanstack/react-router";
import { MapPin, Clock, Users, Wrench, ChevronRight, Crown, HandHelping } from "lucide-react";
import type { WorkOrderWithRelations } from "@/types/workOrders";
import { StatusBadge } from "@/components/admin/StatusBadge";

export function EngineerJobCard({
  job,
  currentEngineerId,
}: {
  job: WorkOrderWithRelations;
  currentEngineerId: string | null;
}) {
  const mine = job.assignments.find(
    (a) => a.engineer?.id === currentEngineerId,
  );
  const isLead = mine?.assignment_role === "lead";

  return (
    <Link
      to="/engineer/jobs/$id"
      params={{ id: job.id }}
      className="group block rounded-md border border-border bg-card p-3 shadow-sm transition-colors hover:bg-accent/30 active:bg-accent/50"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-mono text-muted-foreground">
              {job.order_no}
            </span>
            <StatusBadge status={job.current_status} />
          </div>
          <h3 className="mt-1 line-clamp-2 text-sm font-semibold text-foreground">
            {job.job_summary ?? "Untitled job"}
          </h3>
        </div>
        <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-muted-foreground" />
      </div>

      <div className="mt-2 space-y-1 text-xs text-muted-foreground">
        <div className="flex items-center gap-1.5">
          <MapPin className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">
            {job.address_line_1 ?? "No address"}
            {job.postcode_zone ? ` · ${job.postcode_zone}` : ""}
          </span>
        </div>
        <div className="flex items-center gap-3">
          {job.primary_trade ? (
            <span className="inline-flex items-center gap-1">
              <Wrench className="h-3.5 w-3.5" />
              {job.primary_trade}
            </span>
          ) : null}
          {job.estimated_duration_minutes ? (
            <span className="inline-flex items-center gap-1">
              <Clock className="h-3.5 w-3.5" />
              {job.estimated_duration_minutes}m
            </span>
          ) : null}
          <span className="inline-flex items-center gap-1">
            <Users className="h-3.5 w-3.5" />
            {job.engineers_required}
          </span>
        </div>
      </div>

      {mine ? (
        <div className="mt-2 flex items-center gap-1">
          <span
            className={`inline-flex items-center gap-1 rounded-sm px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${
              isLead
                ? "bg-primary/10 text-primary"
                : "bg-muted text-muted-foreground"
            }`}
          >
            {isLead ? <Crown className="h-3 w-3" /> : <HandHelping className="h-3 w-3" />}
            {isLead ? "Lead" : "Support"}
          </span>
        </div>
      ) : null}
    </Link>
  );
}