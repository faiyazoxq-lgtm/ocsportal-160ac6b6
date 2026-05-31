import { CheckCircle2, CloudOff, Loader2, AlertTriangle, RefreshCw } from "lucide-react";
import { useWorkOrderSyncState } from "@/hooks/useWorkOrderSyncState";
import { useSyncEngine } from "@/hooks/useSyncEngine";
import { useOfflineStatus } from "@/hooks/useOfflineStatus";
import { toast } from "sonner";

/**
 * Compact per-work-order sync indicator. Shows synced / pending / failed
 * with a one-tap retry when there is anything queued.
 */
export function SyncStatusBadge({ workOrderId }: { workOrderId: string }) {
  const { status, pendingCount, failedCount } = useWorkOrderSyncState(workOrderId);
  const { syncNow, running } = useSyncEngine();
  const { offline } = useOfflineStatus();

  const onRetry = async () => {
    if (offline) {
      toast.info("You're offline — will retry when back online");
      return;
    }
    const res = await syncNow();
    if (res.failed === 0) {
      toast.success("Synced", { description: `${res.processed} item(s) sent` });
    } else {
      toast.error("Some items failed", {
        description: `${res.processed} sent · ${res.failed} failed`,
      });
    }
  };

  if (status === "synced" && !running) {
    return (
      <span className="inline-flex items-center gap-1 rounded-sm bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200">
        <CheckCircle2 className="h-3 w-3" />
        Synced
      </span>
    );
  }

  if (running) {
    return (
      <span className="inline-flex items-center gap-1 rounded-sm bg-muted px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-foreground">
        <Loader2 className="h-3 w-3 animate-spin" />
        Syncing
      </span>
    );
  }

  const isFailed = status === "failed";
  return (
    <button
      type="button"
      onClick={onRetry}
      className={`inline-flex items-center gap-1 rounded-sm px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider transition hover:opacity-80 ${
        isFailed
          ? "bg-destructive/10 text-destructive"
          : offline
            ? "bg-amber-100 text-amber-900 dark:bg-amber-950/40 dark:text-amber-200"
            : "bg-amber-100 text-amber-900 dark:bg-amber-950/40 dark:text-amber-200"
      }`}
      title="Tap to retry sync"
    >
      {isFailed ? (
        <AlertTriangle className="h-3 w-3" />
      ) : offline ? (
        <CloudOff className="h-3 w-3" />
      ) : (
        <RefreshCw className="h-3 w-3" />
      )}
      {isFailed ? `${failedCount} failed` : `${pendingCount} pending`}
    </button>
  );
}
