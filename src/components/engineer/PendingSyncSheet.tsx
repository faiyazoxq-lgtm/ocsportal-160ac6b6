import { Link } from "@tanstack/react-router";
import { CloudOff, RefreshCw, AlertTriangle, Loader2, Trash2, FileX } from "lucide-react";
import { toast } from "sonner";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { usePendingSyncSummary } from "@/hooks/usePendingSyncSummary";
import { removeMutation } from "@/services/offlineQueue";
import type { QueuedMutation, QueuedMutationType } from "@/services/offlineQueue";

const TYPE_LABEL: Record<QueuedMutationType, string> = {
  mark_on_route: "On route",
  mark_arrived: "Arrived",
  start_work: "Start work",
  checklist_save: "Checklist",
  evidence_add: "Evidence upload",
  expense_add: "Expense / receipt",
  submit_complete: "Submit complete",
  submit_incomplete: "Submit incomplete",
};

function describe(m: QueuedMutation): string {
  return TYPE_LABEL[m.type] ?? m.type;
}

export function PendingSyncSheet({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const {
    online,
    running,
    pendingCount,
    failedCount,
    lastSyncedAt,
    byWorkOrder,
    syncNow,
  } = usePendingSyncSummary();

  const onSync = async () => {
    if (!online) {
      toast.info("You're offline");
      return;
    }
    const res = await syncNow();
    toast.success("Sync attempted", {
      description: `${res.processed} sent · ${res.failed} failed`,
    });
  };

  const onDiscard = async (id: string) => {
    await removeMutation(id);
    toast.success("Removed from queue");
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto p-0">
        <div className="border-b border-border bg-card px-4 py-3">
          <SheetHeader className="text-left">
            <SheetTitle className="text-sm font-semibold">Sync status</SheetTitle>
            <SheetDescription className="text-xs">
              {online ? "Online" : "Offline"}
              {" · "}
              {pendingCount} pending
              {failedCount ? ` · ${failedCount} failed` : ""}
              {lastSyncedAt
                ? ` · last ${new Date(lastSyncedAt).toLocaleTimeString()}`
                : ""}
            </SheetDescription>
          </SheetHeader>
          <div className="mt-3 flex gap-2">
            <Button
              size="sm"
              className="h-9 flex-1"
              onClick={onSync}
              disabled={running}
            >
              {running ? (
                <Loader2 className="mr-1 h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="mr-1 h-4 w-4" />
              )}
              {online ? "Sync now" : "Offline"}
            </Button>
          </div>
        </div>

        <div className="space-y-3 px-4 py-3">
          {!byWorkOrder.length ? (
            <div className="rounded-md border border-dashed border-border bg-card p-6 text-center text-xs text-muted-foreground">
              {online ? (
                "Everything is synced. You're good to go."
              ) : (
                <span className="inline-flex items-center gap-1.5">
                  <CloudOff className="h-3.5 w-3.5" /> No pending items.
                </span>
              )}
            </div>
          ) : (
            byWorkOrder.map((g) => (
              <div
                key={g.workOrderId ?? "unassigned"}
                className="rounded-md border border-border bg-card"
              >
                <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-2">
                  <div className="min-w-0 flex-1">
                    <div className="text-[11px] font-mono uppercase tracking-wide text-muted-foreground">
                      {g.workOrderId ? "Work order" : "Other"}
                    </div>
                    {g.workOrderId ? (
                      <Link
                        to="/engineer/jobs/$id"
                        params={{ id: g.workOrderId }}
                        onClick={() => onOpenChange(false)}
                        className="block truncate text-sm font-medium text-primary underline-offset-2 hover:underline"
                      >
                        Open job
                      </Link>
                    ) : null}
                  </div>
                  {g.failedCount ? (
                    <span className="inline-flex items-center gap-1 rounded-sm bg-destructive/10 px-1.5 py-0.5 text-[10px] font-semibold text-destructive">
                      <AlertTriangle className="h-3 w-3" />
                      {g.failedCount} failed
                    </span>
                  ) : null}
                </div>
                <ul className="divide-y divide-border">
                  {g.pending.map((m) => (
                    <li
                      key={m.id}
                      className="flex items-center justify-between gap-2 px-3 py-2 text-xs"
                    >
                      <div className="min-w-0">
                        <div className="font-medium text-foreground">
                          {describe(m)}
                        </div>
                        <div className="truncate text-[10px] text-muted-foreground">
                          {m.status}
                          {m.retry_count ? ` · ${m.retry_count} retry(ies)` : ""}
                          {m.error_message ? ` · ${m.error_message}` : ""}
                        </div>
                      </div>
                      {m.status === "failed" ? (
                        <button
                          type="button"
                          onClick={() => void onDiscard(m.id)}
                          className="inline-flex items-center gap-1 rounded-sm border border-border bg-background px-2 py-1 text-[10px] font-medium text-muted-foreground hover:bg-accent"
                          aria-label="Discard failed item"
                        >
                          <Trash2 className="h-3 w-3" />
                          Discard
                        </button>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </div>
            ))
          )}

          {failedCount ? (
            <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive">
              <FileX className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <div>
                <div className="font-semibold">Some updates couldn't sync</div>
                <p className="mt-1 text-[11px] opacity-90">
                  Open the affected job and try the action again. If it keeps
                  failing, discard the queued item — your latest action will be
                  re-recorded.
                </p>
              </div>
            </div>
          ) : null}
        </div>
      </SheetContent>
    </Sheet>
  );
}