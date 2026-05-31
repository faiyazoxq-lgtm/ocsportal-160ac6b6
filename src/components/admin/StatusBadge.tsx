import type { WorkOrderStatus, PriorityLevel } from "@/types/workOrders";

const STATUS_STYLES: Record<string, string> = {
  ingested: "bg-muted text-muted-foreground",
  parsing_in_progress: "bg-amber-100 text-amber-900",
  admin_attention: "bg-red-100 text-red-900",
  parsed_ready: "bg-sky-100 text-sky-900",
  categorized: "bg-sky-100 text-sky-900",
  ready_for_dispatch: "bg-emerald-100 text-emerald-900",
  scheduled_in_sheet: "bg-indigo-100 text-indigo-900",
  assigned: "bg-indigo-100 text-indigo-900",
  accepted: "bg-indigo-100 text-indigo-900",
  en_route: "bg-blue-100 text-blue-900",
  on_site: "bg-blue-100 text-blue-900",
  field_in_progress: "bg-blue-100 text-blue-900",
  field_submitted_complete: "bg-emerald-100 text-emerald-900",
  field_submitted_incomplete: "bg-amber-100 text-amber-900",
  dispatcher_review: "bg-amber-100 text-amber-900",
  follow_up_required: "bg-amber-100 text-amber-900",
  closed: "bg-muted text-muted-foreground",
  cancelled: "bg-muted text-muted-foreground",
  duplicate_flagged: "bg-red-100 text-red-900",
  ignored: "bg-muted text-muted-foreground",
};

export function StatusBadge({ status }: { status: WorkOrderStatus }) {
  const cls = STATUS_STYLES[status] ?? "bg-muted text-muted-foreground";
  return (
    <span
      className={`inline-flex items-center rounded-sm px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide ${cls}`}
    >
      {status.replace(/_/g, " ")}
    </span>
  );
}

const PRIORITY_STYLES: Record<PriorityLevel, string> = {
  low: "bg-muted text-muted-foreground",
  normal: "bg-sky-50 text-sky-900 border border-sky-200",
  high: "bg-amber-50 text-amber-900 border border-amber-200",
  urgent: "bg-red-50 text-red-900 border border-red-200",
};

export function PriorityBadge({ priority }: { priority: PriorityLevel }) {
  return (
    <span
      className={`inline-flex items-center rounded-sm px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide ${PRIORITY_STYLES[priority]}`}
    >
      {priority}
    </span>
  );
}

export function ConfidenceCell({ value }: { value: number | null }) {
  if (value == null) return <span className="text-muted-foreground">—</span>;
  const pct = Math.round(value * 100);
  const tone =
    pct >= 85
      ? "text-emerald-700"
      : pct >= 60
        ? "text-amber-700"
        : "text-red-700";
  return <span className={`tabular-nums ${tone}`}>{pct}%</span>;
}