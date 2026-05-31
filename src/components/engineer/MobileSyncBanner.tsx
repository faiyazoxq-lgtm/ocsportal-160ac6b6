import { useState } from "react";
import { CloudOff, Cloud, RefreshCw, AlertTriangle, Loader2, Signal } from "lucide-react";
import { toast } from "sonner";
import { usePendingSyncSummary } from "@/hooks/usePendingSyncSummary";
import { useConnectivityStatus } from "@/hooks/useConnectivityStatus";
import { PendingSyncSheet } from "./PendingSyncSheet";

/**
 * Compact, always-on mobile status bar. Tap opens the PendingSyncSheet for
 * details and recovery actions. Stays out of the way when everything is fine.
 */
export function MobileSyncBanner() {
  const { online, running, pendingCount, failedCount, lastSyncedAt, syncNow } =
    usePendingSyncSummary();
  const { weak } = useConnectivityStatus();
  const [sheetOpen, setSheetOpen] = useState(false);

  const healthy = online && pendingCount === 0 && !running && !failedCount;
  if (healthy && !weak) return null;

  const tone = !online
    ? "bg-amber-50 text-amber-900 dark:bg-amber-950/40 dark:text-amber-100"
    : failedCount
      ? "bg-destructive/10 text-destructive"
      : weak
        ? "bg-amber-50 text-amber-900 dark:bg-amber-950/40 dark:text-amber-100"
        : "bg-muted/40 text-foreground";

  const onRetry = async () => {
    if (!online) {
      toast.info("You're offline", {
        description: "We'll sync as soon as you're back online.",
      });
      return;
    }
    const res = await syncNow();
    if (res.failed) {
      toast.error("Some items still failed", {
        description: `${res.processed} synced · ${res.failed} failed`,
      });
    } else if (res.processed) {
      toast.success("Synced", { description: `${res.processed} item(s) sent` });
    } else {
      toast.success("Up to date");
    }
  };

  return (
    <>
      <div className={`flex items-center justify-between gap-2 border-b border-border px-3 py-2 text-xs ${tone}`}>
        <button
          type="button"
          onClick={() => setSheetOpen(true)}
          className="flex min-w-0 flex-1 items-center gap-2 text-left"
          aria-label="Open sync details"
        >
          {!online ? (
            <>
              <CloudOff className="h-4 w-4 shrink-0" />
              <span className="truncate font-medium">
                Offline{pendingCount ? ` · ${pendingCount} queued` : ""}
              </span>
            </>
          ) : failedCount ? (
            <>
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span className="truncate font-medium">
                {failedCount} failed · tap to review
              </span>
            </>
          ) : running ? (
            <>
              <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
              <span className="truncate font-medium">Syncing…</span>
            </>
          ) : pendingCount ? (
            <>
              <Cloud className="h-4 w-4 shrink-0" />
              <span className="truncate font-medium">{pendingCount} pending</span>
            </>
          ) : (
            <>
              <Signal className="h-4 w-4 shrink-0" />
              <span className="truncate font-medium">Weak signal</span>
            </>
          )}
          {lastSyncedAt ? (
            <span className="hidden truncate text-[10px] text-muted-foreground sm:inline">
              · {new Date(lastSyncedAt).toLocaleTimeString()}
            </span>
          ) : null}
        </button>
        <button
          type="button"
          onClick={onRetry}
          className="inline-flex items-center gap-1 rounded-sm border border-border bg-background px-2 py-1.5 text-[11px] font-medium hover:bg-accent active:scale-[0.98]"
          aria-label="Sync now"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${running ? "animate-spin" : ""}`} />
          Sync
        </button>
      </div>
      <PendingSyncSheet open={sheetOpen} onOpenChange={setSheetOpen} />
    </>
  );
}