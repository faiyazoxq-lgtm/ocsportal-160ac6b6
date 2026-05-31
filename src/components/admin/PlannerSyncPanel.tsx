import { useState } from "react";
import { CloudUpload, CloudDownload, History, AlertTriangle, Check, CloudOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { WorkOrder } from "@/types/workOrders";
import { usePlannerSync } from "@/hooks/usePlannerSync";
import { SheetSyncHistoryDialog } from "./SheetSyncHistoryDialog";

function fmt(d: string | null | undefined) {
  if (!d) return "—";
  try { return new Date(d).toLocaleString(); } catch { return d; }
}

export function PlannerSyncPanel({ wo }: { wo: WorkOrder }) {
  const { push, pull } = usePlannerSync();
  const [historyOpen, setHistoryOpen] = useState(false);

  const state = wo.planner_conflict_flag
    ? { label: "Conflict", className: "bg-amber-100 text-amber-900", Icon: AlertTriangle }
    : wo.planner_last_pushed_at
      ? { label: "Synced", className: "bg-emerald-100 text-emerald-900", Icon: Check }
      : { label: "Never synced", className: "bg-muted text-muted-foreground", Icon: CloudOff };

  return (
    <div className="space-y-3">
      {wo.planner_conflict_flag && wo.planner_conflict_message && (
        <div className="flex items-start gap-2 rounded-md border border-amber-300/70 bg-amber-50 p-3 text-xs text-amber-900">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <div>
            <div className="font-semibold">Planner sheet conflict</div>
            <p className="mt-0.5">{wo.planner_conflict_message}</p>
            <p className="mt-1 text-amber-800">
              Resolve by pushing the app version to overwrite the sheet, or by editing the sheet to match.
            </p>
          </div>
        </div>
      )}

      <div className="flex items-center gap-2">
        <span className={`inline-flex items-center gap-1 rounded-sm px-1.5 py-0.5 text-[10px] font-semibold uppercase ${state.className}`}>
          <state.Icon className="h-3 w-3" />
          {state.label}
        </span>
        {wo.planner_row_key && (
          <span className="text-[11px] text-muted-foreground">
            row key · <span className="font-mono">{wo.planner_row_key}</span>
          </span>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2 text-[11px]">
        <Tile label="Last pushed" value={fmt(wo.planner_last_pushed_at)} />
        <Tile label="Last pulled" value={fmt(wo.planner_last_pulled_at)} />
        <Tile label="Sheet" value={wo.planner_sheet_name ?? "—"} />
        <Tile label="Direction" value="Push + auto pull" />
      </div>

      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="outline" onClick={() => push.mutate(wo.id)} disabled={push.isPending}>
          <CloudUpload className="mr-1 h-3.5 w-3.5" />
          {push.isPending ? "Pushing…" : "Push to sheet"}
        </Button>
        <Button size="sm" variant="outline" onClick={() => pull.mutate(wo.id)} disabled={pull.isPending}>
          <CloudDownload className="mr-1 h-3.5 w-3.5" />
          {pull.isPending ? "Pulling…" : "Pull planner"}
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setHistoryOpen(true)}>
          <History className="mr-1 h-3.5 w-3.5" />
          History
        </Button>
      </div>

      <SheetSyncHistoryDialog workOrderId={wo.id} open={historyOpen} onOpenChange={setHistoryOpen} />
    </div>
  );
}

function Tile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border bg-card px-2.5 py-2">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-0.5 truncate text-xs font-medium text-foreground">{value}</div>
    </div>
  );
}