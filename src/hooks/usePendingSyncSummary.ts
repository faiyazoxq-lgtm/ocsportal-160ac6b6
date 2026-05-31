import { useMemo } from "react";
import { useSyncEngine } from "./useSyncEngine";
import type { QueuedMutation } from "@/services/offlineQueue";

export interface PendingSyncSummary {
  online: boolean;
  running: boolean;
  lastSyncedAt: number | null;
  total: number;
  pendingCount: number;
  failedCount: number;
  byWorkOrder: Array<{
    workOrderId: string | null;
    pending: QueuedMutation[];
    failedCount: number;
  }>;
  syncNow: () => Promise<{ processed: number; failed: number }>;
}

/**
 * Field-friendly rollup of the offline queue, grouped by work order so the
 * engineer can see exactly which jobs still have unsynced changes.
 */
export function usePendingSyncSummary(): PendingSyncSummary {
  const { queue, pendingCount, failedCount, online, running, lastSyncedAt, syncNow } =
    useSyncEngine();

  const byWorkOrder = useMemo(() => {
    const map = new Map<string | null, QueuedMutation[]>();
    for (const m of queue) {
      if (m.status === "synced") continue;
      const key = m.work_order_id ?? null;
      const arr = map.get(key) ?? [];
      arr.push(m);
      map.set(key, arr);
    }
    return Array.from(map.entries()).map(([workOrderId, pending]) => ({
      workOrderId,
      pending,
      failedCount: pending.filter((p) => p.status === "failed").length,
    }));
  }, [queue]);

  return {
    online,
    running,
    lastSyncedAt,
    total: queue.length,
    pendingCount,
    failedCount,
    byWorkOrder,
    syncNow,
  };
}