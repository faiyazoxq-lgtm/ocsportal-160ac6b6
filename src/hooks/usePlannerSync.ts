import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  pushWorkOrderToSheet,
  pushBatchToSheet,
  pullPlannerUpdates,
} from "@/lib/plannerSync.functions";

export function usePlannerSync() {
  const qc = useQueryClient();
  const pushFn = useServerFn(pushWorkOrderToSheet);
  const batchPushFn = useServerFn(pushBatchToSheet);
  const pullFn = useServerFn(pullPlannerUpdates);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["work_orders"] });
    qc.invalidateQueries({ queryKey: ["sheet_sync_log"] });
  };

  const push = useMutation({
    mutationFn: (workOrderId: string) => pushFn({ data: { workOrderId } }),
    onSuccess: () => {
      toast.success("Pushed to planner sheet");
      invalidate();
    },
    onError: (e: Error) => toast.error(`Push failed: ${e.message}`),
  });

  const batchPush = useMutation({
    mutationFn: (workOrderIds: string[]) => batchPushFn({ data: { workOrderIds } }),
    onSuccess: (r) => {
      toast.success(`Batch push complete · ${r.success} ok · ${r.failed} failed`);
      invalidate();
    },
    onError: (e: Error) => toast.error(`Batch push failed: ${e.message}`),
  });

  const pull = useMutation({
    mutationFn: (workOrderId?: string) =>
      pullFn({ data: workOrderId ? { workOrderId } : {} }),
    onSuccess: (r) => {
      const parts = [
        `${r.applied} applied`,
        r.conflicts ? `${r.conflicts} conflicts` : null,
        `${r.unchanged} unchanged`,
      ].filter(Boolean);
      toast.success(`Planner pull · ${parts.join(" · ")}`);
      invalidate();
    },
    onError: (e: Error) => toast.error(`Pull failed: ${e.message}`),
  });

  return { push, batchPush, pull };
}