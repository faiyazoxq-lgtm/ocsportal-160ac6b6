import type { WorkOrderStatus, PriorityLevel } from "@/types/workOrders";

// Dark, high-contrast pills — readable on light cards and bright dispatch rows.
const STATUS_STYLES: Record<string, string> = {
  ingested: "bg-slate-700 text-white",
  parsing_in_progress: "bg-amber-600 text-white",
  admin_attention: "bg-red-700 text-white",
  parsed_ready: "bg-sky-700 text-white",
  categorized: "bg-sky-700 text-white",
  awaiting_client_confirmation: "bg-white text-slate-900 border border-slate-400",
  ready_for_dispatch: "bg-cyan-800 text-white",
  scheduled_in_sheet: "bg-violet-800 text-white",
  assigned: "bg-orange-700 text-white",
  accepted: "bg-emerald-800 text-white",
  en_route: "bg-amber-700 text-white",
  on_site: "bg-yellow-700 text-white",
  field_in_progress: "bg-rose-700 text-white",
  field_submitted_complete: "bg-emerald-700 text-white",
  field_submitted_incomplete: "bg-amber-700 text-white",
  dispatcher_review: "bg-amber-700 text-white",
  follow_up_required: "bg-amber-700 text-white",
  closed: "bg-slate-600 text-white",
  cancelled: "bg-slate-600 text-white",
  duplicate_flagged: "bg-red-700 text-white",
  ignored: "bg-slate-500 text-white",
};

export function StatusBadge({ status }: { status: WorkOrderStatus }) {
  const cls = STATUS_STYLES[status] ?? "bg-muted text-muted-foreground";
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.08em] shadow-sm ${cls}`}
    >
      {status.replace(/_/g, " ")}
    </span>
  );
}

const PRIORITY_STYLES: Record<PriorityLevel, string> = {
  low: "bg-slate-600 text-white",
  normal: "bg-sky-700 text-white",
  high: "bg-amber-600 text-white",
  urgent: "bg-red-700 text-white",
};

export function PriorityBadge({ priority }: { priority: PriorityLevel }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.08em] shadow-sm ${PRIORITY_STYLES[priority]}`}
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