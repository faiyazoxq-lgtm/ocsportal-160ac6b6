import { Navigation2, MapPin, PlayCircle, CloudOff, Check } from "lucide-react";
import { toast } from "sonner";
import { useQueuedMutation } from "@/hooks/useQueuedMutation";
import { useOfflineStatus } from "@/hooks/useOfflineStatus";
import { useWorkOrderSyncState } from "@/hooks/useWorkOrderSyncState";
import type { WorkOrderStatus } from "@/types/workOrders";
import type { QueuedMutationType } from "@/services/offlineQueue";

const STEPS: {
  type: Extract<QueuedMutationType, "mark_on_route" | "mark_arrived" | "start_work">;
  status: WorkOrderStatus;
  label: string;
  Icon: typeof Navigation2;
}[] = [
  { type: "mark_on_route", status: "en_route", label: "On route", Icon: Navigation2 },
  { type: "mark_arrived", status: "on_site", label: "Arrived", Icon: MapPin },
  { type: "start_work", status: "field_in_progress", label: "Start work", Icon: PlayCircle },
];

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

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-3 gap-2">
        {STEPS.map(({ type, status, label, Icon }) => {
          const isCurrent = currentStatus === status;
          return (
            <button
              key={type}
              type="button"
              disabled={queued.isPending}
              onClick={() =>
                queued.mutate(
                  { type, payload: { at: new Date().toISOString() } },
                  {
                    onSuccess: (res) =>
                      res.queued
                        ? toast.info(label, {
                            description: offline
                              ? "Saved offline — will sync when online"
                              : "Queued for retry",
                          })
                        : toast.success(label, { description: "Status updated" }),
                    onError: (e) =>
                      toast.error("Update failed", {
                        description: e instanceof Error ? e.message : "Unknown error",
                      }),
                  },
                )
              }
              className={`flex flex-col items-center justify-center gap-1 rounded-md border px-2 py-3 text-xs font-medium transition-colors disabled:opacity-60 ${
                isCurrent
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border bg-card text-foreground hover:bg-accent/40"
              }`}
            >
              <Icon className="h-5 w-5" />
              <span>{label}</span>
            </button>
          );
        })}
      </div>
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