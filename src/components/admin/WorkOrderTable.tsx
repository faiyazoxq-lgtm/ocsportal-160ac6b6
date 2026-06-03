import { Inbox, Lock, CloudOff, AlertTriangle, FileSpreadsheet } from "lucide-react";
import type { WorkOrderWithRelations, WorkOrderStatus } from "@/types/workOrders";
import { StatusBadge, PriorityBadge, ConfidenceCell } from "./StatusBadge";
import { useSiteSettings, readableInk } from "@/hooks/useSiteSettings";
import { DEFAULT_STATUS_COLORS } from "@/lib/statusColors";

// Email-intake / pre-dispatch statuses always render on a white background
// inside ALL WORK ORDERS so they're visually distinct from active dispatch rows.
const INTAKE_WHITE_STATUSES: ReadonlySet<WorkOrderStatus> = new Set<WorkOrderStatus>([
  "ingested",
  "parsing_in_progress",
  "parsed_ready",
  "categorized",
  "awaiting_client_confirmation",
]);

// Prestige dispatch-board row tints — saturated colour with deep ink text
// so every cell stays crisply legible on the coloured background.
const DISPATCH_ROW_TINTS: Partial<Record<WorkOrderStatus, string>> = {
  awaiting_client_confirmation:
    "bg-white hover:bg-slate-50 border-l-[6px] border-l-slate-400 text-slate-900",
  ready_for_dispatch:
    "bg-yellow-400 hover:bg-yellow-300 border-l-[6px] border-l-yellow-700 text-slate-900",
  scheduled_in_sheet:
    "bg-orange-300/85 hover:bg-orange-300 border-l-[6px] border-l-orange-700 text-slate-900",
  assigned:
    "bg-orange-300/85 hover:bg-orange-300 border-l-[6px] border-l-orange-700 text-slate-900",
  accepted:
    "bg-orange-300/85 hover:bg-orange-300 border-l-[6px] border-l-orange-700 text-slate-900",
  en_route:
    "bg-orange-400/85 hover:bg-orange-400 border-l-[6px] border-l-orange-800 text-slate-900",
  on_site:
    "bg-orange-400/85 hover:bg-orange-400 border-l-[6px] border-l-orange-800 text-slate-900",
  field_in_progress:
    "bg-orange-400/85 hover:bg-orange-400 border-l-[6px] border-l-orange-800 text-slate-900",
  field_submitted_complete:
    "bg-red-400/85 hover:bg-red-400 border-l-[6px] border-l-red-700 text-slate-900",
  field_submitted_incomplete:
    "bg-red-400/85 hover:bg-red-400 border-l-[6px] border-l-red-700 text-slate-900",
  dispatcher_review:
    "bg-red-400/85 hover:bg-red-400 border-l-[6px] border-l-red-700 text-slate-900",
};

export function WorkOrderTable({
  rows,
  onRowClick,
  isLoading,
  error,
  emptyMessage = "No work orders match this view.",
  variant = "default",
}: {
  rows: WorkOrderWithRelations[] | undefined;
  onRowClick: (id: string) => void;
  isLoading: boolean;
  error: unknown;
  emptyMessage?: string;
  variant?: "default" | "dispatch";
}) {
  const isDispatch = variant === "dispatch";
  const { data: siteSettings } = useSiteSettings();
  const overrides = siteSettings?.status_colors ?? {};
  if (isLoading) {
    return (
      <div className="rounded-md border border-border bg-card">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="h-11 animate-pulse border-b border-border bg-muted/40 last:border-b-0"
          />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-900">
        Couldn't load work orders. {(error as Error).message}
      </div>
    );
  }

  if (!rows || rows.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 rounded-md border border-dashed border-border bg-card px-4 py-12 text-center">
        <Inbox className="h-5 w-5 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div
      className={`overflow-x-auto rounded-lg border bg-card shadow-sm ${
        isDispatch ? "border-slate-300 shadow-md" : "border-border"
      }`}
    >
      <table className="w-full min-w-[760px] text-sm">
        <thead
          className={
            isDispatch
              ? "bg-slate-900 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-100"
              : "bg-secondary text-[11px] uppercase tracking-wider text-muted-foreground"
          }
        >
          <tr>
            <Th>Order</Th>
            <Th>Client</Th>
            <Th>Site</Th>
            <Th>{isDispatch ? "Summary" : "Trade"}</Th>
            <Th>Status</Th>
            <Th>Priority</Th>
            {!isDispatch && <Th>Parse</Th>}
            <Th>Created</Th>
          </tr>
        </thead>
        <tbody className={isDispatch ? "divide-y divide-slate-300/60" : ""}>
          {rows.map((w) => (
            <DispatchRow
              key={w.id}
              w={w}
              isDispatch={isDispatch}
              overrideHex={
                INTAKE_WHITE_STATUSES.has(w.current_status)
                  ? "#ffffff"
                  : overrides[w.current_status] ?? DEFAULT_STATUS_COLORS[w.current_status]
              }
              onClick={() => onRowClick(w.id)}
            >
              <Td>
                <span
                  className={
                    isDispatch
                      ? "text-[13px] font-bold tracking-wide text-slate-900"
                      : "font-medium text-foreground"
                  }
                >
                  {w.order_no}
                </span>
                {(w.field_lock_active ||
                  w.pending_sync_flag ||
                  w.planner_conflict_flag ||
                  w.planner_row_key) && (
                  <div className="mt-1 flex gap-1">
                    {w.field_lock_active && (
                      <span
                        title="Field-locked by lead engineer"
                        className="inline-flex items-center gap-0.5 rounded-sm bg-slate-900/85 px-1 py-0.5 text-[9px] font-bold uppercase tracking-wide text-amber-200"
                      >
                        <Lock className="h-2.5 w-2.5" />
                        Locked
                      </span>
                    )}
                    {w.pending_sync_flag && (
                      <span
                        title="Pending field sync"
                        className="inline-flex items-center gap-0.5 rounded-sm bg-slate-900/85 px-1 py-0.5 text-[9px] font-bold uppercase tracking-wide text-amber-200"
                      >
                        <CloudOff className="h-2.5 w-2.5" />
                        Sync
                      </span>
                    )}
                    {w.planner_conflict_flag ? (
                      <span
                        title={w.planner_conflict_message ?? "Planner conflict — review sync panel"}
                        className="inline-flex items-center gap-0.5 rounded-sm bg-red-700 px-1 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white"
                      >
                        <AlertTriangle className="h-2.5 w-2.5" />
                        Conflict
                      </span>
                    ) : w.planner_row_key ? (
                      <span
                        title={`Linked to planner row ${w.planner_row_key}`}
                        className="inline-flex items-center gap-0.5 rounded-sm bg-slate-900/85 px-1 py-0.5 text-[9px] font-bold uppercase tracking-wide text-slate-100"
                      >
                        <FileSpreadsheet className="h-2.5 w-2.5" />
                        Planner
                      </span>
                    ) : null}
                  </div>
                )}
              </Td>
              <Td>
                <span className={isDispatch ? "font-semibold text-slate-900" : ""}>
                  {w.client?.client_name ?? "—"}
                </span>
              </Td>
              <Td>
                <div className="text-xs leading-snug">
                  <div className={isDispatch ? "font-semibold text-slate-900" : ""}>
                    {w.address_line_1 || "—"}
                  </div>
                  <div
                    className={
                      isDispatch
                        ? "font-semibold tracking-wide text-slate-700"
                        : "text-muted-foreground"
                    }
                  >
                    {w.postcode || ""}
                  </div>
                </div>
              </Td>
              <Td>
                {isDispatch ? (
                  <span className="line-clamp-2 text-xs font-medium text-slate-900">
                    {w.job_summary || "—"}
                  </span>
                ) : (
                  "—"
                )}
              </Td>
              <Td><StatusBadge status={w.current_status} /></Td>
              <Td><PriorityBadge priority={w.priority_level} /></Td>
              {!isDispatch && <Td><ConfidenceCell value={w.parsing_confidence} /></Td>}
              <Td
                className={
                  isDispatch
                    ? "text-xs font-semibold tabular-nums text-slate-800"
                    : "text-xs text-muted-foreground"
                }
              >
                {new Date(w.created_at).toLocaleDateString()}
              </Td>
            </DispatchRow>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function DispatchRow({
  w,
  isDispatch,
  overrideHex,
  onClick,
  children,
}: {
  w: WorkOrderWithRelations;
  isDispatch: boolean;
  overrideHex: string | undefined;
  onClick: () => void;
  children: React.ReactNode;
}) {
  const style =
    isDispatch && overrideHex
      ? { backgroundColor: overrideHex, color: readableInk(overrideHex) }
      : undefined;
  const className = `cursor-pointer transition-colors ${
    isDispatch
      ? "font-semibold border-l-[6px] border-l-slate-700/40"
      : "border-t border-border hover:bg-accent/30"
  }`;
  return (
    <tr onClick={onClick} className={className} style={style}>
      {children}
    </tr>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return <th className="px-3 py-2.5 text-left font-semibold">{children}</th>;
}
function Td({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <td className={`px-3 py-3 align-top ${className}`}>{children}</td>;
}