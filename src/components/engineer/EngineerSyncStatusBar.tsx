import { CloudOff, Cloud, RefreshCw, AlertTriangle, Loader2 } from "lucide-react";
import { useSyncEngine } from "@/hooks/useSyncEngine";
import { toast } from "sonner";

export function EngineerSyncStatusBar() {
  const { online, pendingCount, failedCount, running, lastSyncedAt, syncNow } =
    useSyncEngine();

  if (online && pendingCount === 0 && !running) return null;

  const handle = async () => {
    if (!online) {
      toast.info("You're offline");
      return;
    }
    const res = await syncNow();
    toast.success("Sync", {
      description: `${res.processed} processed, ${res.failed} failed`,
    });
  };

  return (
    <div
      className={`flex items-center justify-between gap-2 border-b border-border px-4 py-2 text-xs ${
        !online
          ? "bg-amber-50 text-amber-900 dark:bg-amber-950/40 dark:text-amber-100"
          : failedCount
            ? "bg-destructive/10 text-destructive"
            : "bg-muted/40 text-foreground"
      }`}
    >
      <div className="flex items-center gap-2">
        {!online ? (
          <>
            <CloudOff className="h-3.5 w-3.5" />
            <span className="font-medium">Offline</span>
          </>
        ) : failedCount ? (
          <>
            <AlertTriangle className="h-3.5 w-3.5" />
            <span className="font-medium">{failedCount} sync failure(s)</span>
          </>
        ) : running ? (
          <>
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            <span className="font-medium">Syncing…</span>
          </>
        ) : (
          <>
            <Cloud className="h-3.5 w-3.5" />
            <span className="font-medium">{pendingCount} pending</span>
          </>
        )}
        {lastSyncedAt ? (
          <span className="text-[10px] text-muted-foreground">
            · last synced {new Date(lastSyncedAt).toLocaleTimeString()}
          </span>
        ) : null}
      </div>
      <button
        type="button"
        onClick={handle}
        className="inline-flex items-center gap-1 rounded-sm border border-border bg-background px-2 py-1 text-[11px] font-medium hover:bg-accent"
      >
        <RefreshCw className="h-3 w-3" />
        Sync now
      </button>
    </div>
  );
}