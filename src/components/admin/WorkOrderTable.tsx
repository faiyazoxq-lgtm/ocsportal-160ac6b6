import { Inbox, Lock, CloudOff, AlertTriangle, FileSpreadsheet } from "lucide-react";
import type { WorkOrderWithRelations, WorkOrderStatus } from "@/types/workOrders";
import { StatusBadge, PriorityBadge, ConfidenceCell } from "./StatusBadge";

// Provisional dispatch-board row tints per status. Colours intentionally
// soft so badges & text remain readable; user will refine palette later.
const DISPATCH_ROW_TINTS: Partial<Record<WorkOrderStatus, string>> = {
  ready_for_dispatch:
    "bg-sky-50 hover:bg-sky-100 border-l-4 border-l-sky-400",
  scheduled_in_sheet:
    "bg-violet-50 hover:bg-violet-100 border-l-4 border-l-violet-400",
  assigned:
    "bg-orange-50 hover:bg-orange-100 border-l-4 border-l-orange-500",
  accepted:
    "bg-emerald-50 hover:bg-emerald-100 border-l-4 border-l-emerald-500",
  en_route:
    "bg-amber-50 hover:bg-amber-100 border-l-4 border-l-amber-500",
  on_site:
    "bg-yellow-50 hover:bg-yellow-100 border-l-4 border-l-yellow-500",
  field_in_progress:
    "bg-yellow-50 hover:bg-yellow-100 border-l-4 border-l-yellow-500",
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
    <div className="overflow-hidden rounded-md border border-border bg-card">
      <table className="w-full text-sm">
        <thead className="bg-secondary text-[11px] uppercase tracking-wider text-muted-foreground">
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
        <tbody>
          {rows.map((w) => (
            <tr
              key={w.id}
              onClick={() => onRowClick(w.id)}
              className={`cursor-pointer border-t border-border transition-colors ${
                isDispatch
                  ? DISPATCH_ROW_TINTS[w.current_status] ??
                    "hover:bg-accent/30"
                  : "hover:bg-accent/30"
              }`}
            >
              <Td>
                <span className="font-medium text-foreground">{w.order_no}</span>
                {(w.field_lock_active ||
                  w.pending_sync_flag ||
                  w.planner_conflict_flag ||
                  w.planner_row_key) && (
                  <div className="mt-1 flex gap-1">
                    {w.field_lock_active && (
                      <span
                        title="Field-locked by lead engineer"
                        className="inline-flex items-center gap-0.5 rounded-sm bg-amber-100 px-1 py-0.5 text-[9px] font-semibold uppercase text-amber-900"
                      >
                        <Lock className="h-2.5 w-2.5" />
                        Locked
                      </span>
                    )}
                    {w.pending_sync_flag && (
                      <span
                        title="Pending field sync"
                        className="inline-flex items-center gap-0.5 rounded-sm bg-amber-100 px-1 py-0.5 text-[9px] font-semibold uppercase text-amber-900"
                      >
                        <CloudOff className="h-2.5 w-2.5" />
                        Sync
                      </span>
                    )}
                    {w.planner_conflict_flag ? (
                      <span
                        title={w.planner_conflict_message ?? "Planner conflict — review sync panel"}
                        className="inline-flex items-center gap-0.5 rounded-sm bg-red-100 px-1 py-0.5 text-[9px] font-semibold uppercase text-red-900"
                      >
                        <AlertTriangle className="h-2.5 w-2.5" />
                        Conflict
                      </span>
                    ) : w.planner_row_key ? (
                      <span
                        title={`Linked to planner row ${w.planner_row_key}`}
                        className="inline-flex items-center gap-0.5 rounded-sm bg-secondary px-1 py-0.5 text-[9px] font-semibold uppercase text-muted-foreground"
                      >
                        <FileSpreadsheet className="h-2.5 w-2.5" />
                        Planner
                      </span>
                    ) : null}
                  </div>
                )}
              </Td>
              <Td>{w.client?.client_name ?? "—"}</Td>
              <Td>
                <div className="text-xs">
                  <div>{w.address_line_1 || "—"}</div>
                  <div className="text-muted-foreground">{w.postcode || ""}</div>
                </div>
              </Td>
              <Td>
                {isDispatch ? (
                  <span className="line-clamp-2 text-xs">
                    {w.job_summary || "—"}
                  </span>
                ) : (
                  w.primary_trade || "—"
                )}
              </Td>
              <Td><StatusBadge status={w.current_status} /></Td>
              <Td><PriorityBadge priority={w.priority_level} /></Td>
              {!isDispatch && <Td><ConfidenceCell value={w.parsing_confidence} /></Td>}
              <Td className="text-xs text-muted-foreground">
                {new Date(w.created_at).toLocaleDateString()}
              </Td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return <th className="px-3 py-2 text-left font-medium">{children}</th>;
}
function Td({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <td className={`px-3 py-2.5 align-top ${className}`}>{children}</td>;
}