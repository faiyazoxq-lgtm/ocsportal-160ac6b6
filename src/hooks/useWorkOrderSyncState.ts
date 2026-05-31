import { useEffect, useState, useCallback } from "react";
import {
  listMutations,
  subscribeQueue,
  type QueuedMutation,
} from "@/services/offlineQueue";

export interface WorkOrderSyncState {
  pending: QueuedMutation[];
  pendingCount: number;
  failedCount: number;
  hasPending: boolean;
  status: "synced" | "pending" | "failed";
}

export function useWorkOrderSyncState(workOrderId: string | null) {
  const [pending, setPending] = useState<QueuedMutation[]>([]);

  const refresh = useCallback(async () => {
    if (!workOrderId) {
      setPending([]);
      return;
    }
    const all = await listMutations();
    setPending(
      all.filter(
        (m) => m.work_order_id === workOrderId && m.status !== "synced",
      ),
    );
  }, [workOrderId]);

  useEffect(() => {
    void refresh();
    const u = subscribeQueue(() => void refresh());
    return () => {
      u();
    };
  }, [refresh]);

  const failedCount = pending.filter((p) => p.status === "failed").length;
  const status: WorkOrderSyncState["status"] = failedCount
    ? "failed"
    : pending.length
      ? "pending"
      : "synced";

  return {
    pending,
    pendingCount: pending.length,
    failedCount,
    hasPending: pending.length > 0,
    status,
  };
}