import { Link } from "@tanstack/react-router";
import {
  MapPin,
  Clock,
  Users,
  Wrench,
  ChevronRight,
  Crown,
  HandHelping,
  Phone,
  Navigation2,
  Package,
  User,
} from "lucide-react";
import type { WorkOrderWithRelations } from "@/types/workOrders";
import type { EngineerJobView } from "@/hooks/useEngineerJobs";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { buildMapsUrl, buildTelUrl } from "@/lib/mapsUrl";
import { EngineerQuickActions } from "./EngineerQuickActions";
import { WorkOrderUpdatedBadge } from "./WorkOrderUpdatedBadge";

export function EngineerJobCard({
  job,
  currentEngineerId,
  showQuickActions = true,
}: {
  job: WorkOrderWithRelations | EngineerJobView;
  currentEngineerId: string | null;
  showQuickActions?: boolean;
}) {
  const mine = job.assignments.find(
    (a) => a.engineer?.id === currentEngineerId,
  );
  const isLead = mine?.assignment_role === "lead";
  const teammates = job.assignments.filter(
    (a) =>
      a.engineer &&
      a.engineer.id !== currentEngineerId &&
      a.assignment_status !== "removed",
  );
  const mapsUrl = buildMapsUrl({
    lat: job.latitude,
    lng: job.longitude,
    address: [job.address_line_1, job.address_line_2, job.city]
      .filter(Boolean)
      .join(", "),
    postcode: job.postcode,
  });
  const client = job.client as
    | { client_name: string; contact_name?: string | null; contact_phone?: string | null }
    | null
    | undefined;
  const telUrl = buildTelUrl(client?.contact_phone ?? null);

  return (
    <div className="rounded-md border border-border bg-card shadow-sm">
      <Link
        to="/engineer/jobs/$id"
        params={{ id: job.id }}
        className="block p-3 transition-colors hover:bg-accent/30 active:bg-accent/50"
      >
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[11px] font-mono text-muted-foreground">
                {job.order_no}
              </span>
              <StatusBadge status={job.current_status} />
              <WorkOrderUpdatedBadge
                createdAt={job.created_at}
                updatedAt={job.updated_at}
              />
              {mine ? (
                <span
                  className={`inline-flex items-center gap-1 rounded-sm px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${
                    isLead
                      ? "bg-primary/10 text-primary"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  {isLead ? (
                    <Crown className="h-3 w-3" />
                  ) : (
                    <HandHelping className="h-3 w-3" />
                  )}
                  {isLead ? "Lead" : "Support"}
                </span>
              ) : null}
            </div>
            <h3 className="mt-1 line-clamp-2 text-sm font-semibold text-foreground">
              {job.job_summary ?? "Untitled job"}
            </h3>
          </div>
          <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-muted-foreground" />
        </div>

        <div className="mt-2 space-y-1 text-xs text-muted-foreground">
          {client ? (
            <div className="flex items-center gap-1.5">
              <User className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">
                {client.client_name}
                {client.contact_name ? ` · ${client.contact_name}` : ""}
              </span>
            </div>
          ) : null}
          <div className="flex items-center gap-1.5">
            <MapPin className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">
              {job.address_line_1 ?? "No address"}
              {job.postcode ? ` · ${job.postcode}` : job.postcode_zone ? ` · ${job.postcode_zone}` : ""}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            {null ? (
              <span className="inline-flex items-center gap-1">
                <Wrench className="h-3.5 w-3.5" />
                
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
              {teammates.length > 0 ? ` · +${teammates.length} w/ you` : ""}
            </span>
          </div>
          {job.tools_materials_hint ? (
            <div className="flex items-start gap-1.5">
              <Package className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span className="line-clamp-2">{job.tools_materials_hint}</span>
            </div>
          ) : null}
        </div>
      </Link>

      {showQuickActions ? (
        <div className="flex items-stretch gap-1.5 border-t border-border bg-muted/30 p-1.5">
          <EngineerQuickActions
            workOrderId={job.id}
            currentStatus={job.current_status}
            isLead={isLead}
          />
          {mapsUrl ? (
            <a
              href={mapsUrl}
              target="_blank"
              rel="noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="flex min-h-[56px] flex-1 basis-0 flex-col items-center justify-center gap-1 rounded-md border border-border bg-background px-1 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-foreground hover:bg-accent/40 active:scale-[0.98]"
              aria-label="Open in maps"
            >
              <Navigation2 className="h-5 w-5" aria-hidden />
              <span>Map</span>
            </a>
          ) : null}
          {telUrl ? (
            <a
              href={telUrl}
              onClick={(e) => e.stopPropagation()}
              className="flex min-h-[56px] flex-1 basis-0 flex-col items-center justify-center gap-1 rounded-md border border-border bg-background px-1 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-foreground hover:bg-accent/40 active:scale-[0.98]"
              aria-label="Call customer"
            >
              <Phone className="h-5 w-5" aria-hidden />
              <span>Call</span>
            </a>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}