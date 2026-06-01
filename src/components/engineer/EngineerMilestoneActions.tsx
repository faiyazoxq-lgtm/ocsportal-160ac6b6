import { PlayCircle, CloudOff, Check } from "lucide-react";
import { toast } from "sonner";
import { useQueuedMutation } from "@/hooks/useQueuedMutation";
import { useOfflineStatus } from "@/hooks/useOfflineStatus";
import { useWorkOrderSyncState } from "@/hooks/useWorkOrderSyncState";
import type { WorkOrderStatus } from "@/types/workOrders";

const STARTED_STATUSES: WorkOrderStatus[] = ["field_in_progress"];

export function EngineerMilestoneActions({
  workOrderId,
  currentStatus,
}: {
  workOrderId: string;
  currentStatus: WorkOrderStatus;
}) {
  const queued = useQueuedMutation(workOrderId);
  const { offline } = useOfflineStatus();
  const sync = useWorkOrderSyncState(workOrderId);

  const isStarted = STARTED_STATUSES.includes(currentStatus);
  const label = isStarted ? "Work in progress" : "Start work";

  return (
    <div className="space-y-2">
      <button
        type="button"
        disabled={queued.isPending || isStarted}
        onClick={() =>
          queued.mutate(
            { type: "start_work", payload: { at: new Date().toISOString() } },
            {
              onSuccess: (res) =>
                res.queued
                  ? toast.info(label, {
                      description: offline
                        ? "Saved offline — will sync when online"
                        : "Queued for retry",
                    })
                  : toast.success("Work started", { description: "Status updated" }),
              onError: (e) =>
                toast.error("Update failed", {
                  description: e instanceof Error ? e.message : "Unknown error",
                }),
            },
          )
        }
        className={`flex w-full items-center justify-center gap-2 rounded-md border px-3 py-3 text-sm font-semibold transition-colors disabled:opacity-60 ${
          isStarted
            ? "border-primary bg-primary/10 text-primary"
            : "border-primary bg-primary text-primary-foreground hover:bg-primary/90"
        }`}
      >
        <PlayCircle className="h-5 w-5" />
        <span>{label}</span>
      </button>
      <MilestoneSyncLine offline={offline} sync={sync} />
    </div>
  );
}

function MilestoneSyncLine({
  offline,
  sync,
}: {
  offline: boolean;
  sync: ReturnType<typeof useWorkOrderSyncState>;
}) {
  if (sync.failedCount > 0) {
    return (
      <p className="inline-flex items-center gap-1 text-[10px] font-medium text-destructive">
        <CloudOff className="h-3 w-3" />
        {sync.failedCount} update{sync.failedCount === 1 ? "" : "s"} failed — will retry
      </p>
    );
  }
  if (sync.pendingCount > 0) {
    return (
      <p className="inline-flex items-center gap-1 text-[10px] font-medium text-amber-700">
        <CloudOff className="h-3 w-3" />
        {sync.pendingCount} update{sync.pendingCount === 1 ? "" : "s"} pending sync
      </p>
    );
  }
  if (offline) {
    return (
      <p className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
        <CloudOff className="h-3 w-3" />
        Offline — actions will queue
      </p>
    );
  }
  return (
    <p className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
      <Check className="h-3 w-3 text-emerald-600" />
      All updates synced
    </p>
  );
}