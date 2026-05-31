import { useEffect, useState, useCallback } from "react";
import {
  getSyncSnapshot,
  subscribeSync,
  syncNow,
  type SyncEngineSnapshot,
} from "@/services/syncEngine";
import { listMutations, subscribeQueue, type QueuedMutation } from "@/services/offlineQueue";

export function useSyncEngine() {
  const [snapshot, setSnapshot] = useState<SyncEngineSnapshot>(getSyncSnapshot());
  const [queue, setQueue] = useState<QueuedMutation[]>([]);

  const refresh = useCallback(async () => {
    setSnapshot(getSyncSnapshot());
    try {
      setQueue(await listMutations());
    } catch {
      setQueue([]);
    }
  }, []);

  useEffect(() => {
    void refresh();
    const u1 = subscribeSync(() => void refresh());
    const u2 = subscribeQueue(() => void refresh());
    const onNet = () => void refresh();
    window.addEventListener("online", onNet);
    window.addEventListener("offline", onNet);
    return () => {
      u1();
      u2();
      window.removeEventListener("online", onNet);
      window.removeEventListener("offline", onNet);
    };
  }, [refresh]);

  const pendingCount = queue.filter((q) => q.status !== "synced").length;
  const failedCount = queue.filter((q) => q.status === "failed").length;

  return {
    ...snapshot,
    queue,
    pendingCount,
    failedCount,
    syncNow: () => syncNow(),
  };
}