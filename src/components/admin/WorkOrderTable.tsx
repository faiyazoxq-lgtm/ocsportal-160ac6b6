import { Inbox, Lock, CloudOff } from "lucide-react";
import type { WorkOrderWithRelations } from "@/types/workOrders";
import { StatusBadge, PriorityBadge, ConfidenceCell } from "./StatusBadge";

export function WorkOrderTable({
  rows,
  onRowClick,
  isLoading,
  error,
  emptyMessage = "No work orders match this view.",
}: {
  rows: WorkOrderWithRelations[] | undefined;
  onRowClick: (id: string) => void;
  isLoading: boolean;
  error: unknown;
  emptyMessage?: string;
}) {
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
            <Th>Trade</Th>
            <Th>Status</Th>
            <Th>Priority</Th>
            <Th>Parse</Th>
            <Th>Created</Th>
          </tr>
        </thead>
        <tbody>
          {rows.map((w) => (
            <tr
              key={w.id}
              onClick={() => onRowClick(w.id)}
              className="cursor-pointer border-t border-border hover:bg-accent/30"
            >
              <Td>
                <span className="font-medium text-foreground">{w.order_no}</span>
                {(w.field_lock_active || w.pending_sync_flag) && (
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
              <Td>{w.primary_trade || "—"}</Td>
              <Td><StatusBadge status={w.current_status} /></Td>
              <Td><PriorityBadge priority={w.priority_level} /></Td>
              <Td><ConfidenceCell value={w.parsing_confidence} /></Td>
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