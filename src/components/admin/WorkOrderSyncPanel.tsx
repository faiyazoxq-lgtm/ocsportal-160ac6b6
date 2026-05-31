import { Lock, CloudOff, Check, Camera, Receipt, AlertCircle } from "lucide-react";
import type { WorkOrder } from "@/types/workOrders";
import { useEvidenceFiles } from "@/hooks/useEvidenceFiles";
import { useExpenses, EXPENSE_TYPES } from "@/hooks/useExpenses";
import { useEngineers } from "@/hooks/useEngineers";

function fmtDate(iso: string | null | undefined) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

export function WorkOrderSyncPanel({ wo }: { wo: WorkOrder }) {
  const { data: files = [] } = useEvidenceFiles(wo.id);
  const { data: expenses = [] } = useExpenses(wo.id);
  const { data: engineers = [] } = useEngineers();

  const activeEditor = wo.active_editor_engineer_id
    ? engineers.find((e) => e.id === wo.active_editor_engineer_id)
    : null;

  const fileCounts = files.reduce<Record<string, number>>((acc, f) => {
    acc[f.file_kind] = (acc[f.file_kind] ?? 0) + 1;
    return acc;
  }, {});
  const pendingFiles = files.filter((f) => f.sync_status !== "synced").length;
  const totalExpense = expenses.reduce((s, e) => s + Number(e.amount), 0);

  return (
    <div className="space-y-3">
      {wo.field_lock_active ? (
        <div className="flex items-start gap-2 rounded-md border border-amber-300/70 bg-amber-50 p-3 text-xs text-amber-900 dark:bg-amber-950/40 dark:text-amber-100">
          <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <div>
            <div className="font-semibold">Field-locked by lead engineer</div>
            <p className="mt-0.5">
              {activeEditor?.display_name ?? "The lead engineer"} has active
              field progress on this job. Dispatcher status, diary, and
              outcome changes are blocked until they submit or release the
              lock.
              {wo.field_lock_started_at ? (
                <span className="ml-1 text-muted-foreground">
                  (locked since {fmtDate(wo.field_lock_started_at)})
                </span>
              ) : null}
            </p>
          </div>
        </div>
      ) : null}

      <div className="grid grid-cols-2 gap-2 text-xs">
        <Tile
          icon={
            wo.pending_sync_flag ? (
              <CloudOff className="h-3.5 w-3.5 text-amber-700" />
            ) : (
              <Check className="h-3.5 w-3.5 text-emerald-700" />
            )
          }
          label="Sync status"
          value={wo.pending_sync_flag ? "Pending field sync" : "Synced"}
        />
        <Tile
          icon={<Lock className="h-3.5 w-3.5 text-muted-foreground" />}
          label="Field lock"
          value={wo.field_lock_active ? "Active" : "Released"}
        />
        <Tile
          icon={<Check className="h-3.5 w-3.5 text-muted-foreground" />}
          label="Last synced"
          value={fmtDate(wo.last_synced_at)}
        />
        <Tile
          icon={<AlertCircle className="h-3.5 w-3.5 text-muted-foreground" />}
          label="Active editor"
          value={activeEditor?.display_name ?? "—"}
        />
      </div>

      <div className="rounded-md border border-border bg-card p-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
            <Camera className="h-3.5 w-3.5 text-muted-foreground" />
            Evidence ({files.length})
          </div>
          {pendingFiles > 0 ? (
            <span className="inline-flex items-center gap-1 rounded-sm bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-900">
              <CloudOff className="h-3 w-3" />
              {pendingFiles} pending
            </span>
          ) : null}
        </div>
        {files.length === 0 ? (
          <p className="mt-1 text-[11px] text-muted-foreground">No evidence captured yet.</p>
        ) : (
          <div className="mt-2 flex flex-wrap gap-1">
            {Object.entries(fileCounts).map(([k, n]) => (
              <span
                key={k}
                className="rounded-sm border border-border bg-muted/40 px-1.5 py-0.5 text-[10px]"
              >
                {k.replace(/_/g, " ")} · {n}
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="rounded-md border border-border bg-card p-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
            <Receipt className="h-3.5 w-3.5 text-muted-foreground" />
            Expenses ({expenses.length})
          </div>
          <span className="font-mono text-xs">£{totalExpense.toFixed(2)}</span>
        </div>
        {expenses.length === 0 ? (
          <p className="mt-1 text-[11px] text-muted-foreground">No expenses logged.</p>
        ) : (
          <ul className="mt-2 space-y-1 text-[11px]">
            {expenses.slice(0, 5).map((e) => (
              <li key={e.id} className="flex items-center justify-between">
                <span className="text-muted-foreground">
                  {EXPENSE_TYPES.find((t) => t.value === e.expense_type)?.label ?? e.expense_type}
                  {e.note ? ` · ${e.note}` : ""}
                </span>
                <span className="font-mono">£{Number(e.amount).toFixed(2)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function Tile({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-md border border-border bg-card px-2.5 py-2">
      <div className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-muted-foreground">
        {icon}
        {label}
      </div>
      <div className="mt-0.5 truncate text-xs font-medium text-foreground">{value}</div>
    </div>
  );
}