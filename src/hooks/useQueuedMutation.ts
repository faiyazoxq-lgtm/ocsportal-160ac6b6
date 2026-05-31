import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  enqueueMutation,
  type QueuedMutationType,
} from "@/services/offlineQueue";
import { useOfflineStatus } from "./useOfflineStatus";
import { useCurrentEngineer } from "./useEngineerJobs";
import type { WorkOrderStatus, IncompleteReason } from "@/types/workOrders";

const MILESTONE_LABEL: Record<string, string> = {
  mark_on_route: "Engineer on route",
  mark_arrived: "Engineer arrived on site",
  start_work: "Work in progress",
};

const MILESTONE_STATUS: Record<string, WorkOrderStatus> = {
  mark_on_route: "en_route",
  mark_arrived: "on_site",
  start_work: "field_in_progress",
};

/**
 * Offline-first engineer mutation runner. Tries direct write; on offline or
 * network failure, persists to IndexedDB queue for later sync.
 */
export function useQueuedMutation(workOrderId: string) {
  const qc = useQueryClient();
  const { offline } = useOfflineStatus();
  const { data: me } = useCurrentEngineer();

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["engineer", "jobs"] });
    qc.invalidateQueries({
      queryKey: ["engineer", "jobs", "detail", workOrderId],
    });
    qc.invalidateQueries({ queryKey: ["work_orders"] });
  };

  return useMutation({
    mutationFn: async (input: {
      type: QueuedMutationType;
      payload?: Record<string, unknown>;
    }) => {
      const engineerId = me?.id ?? null;
      const payload = input.payload ?? {};

      const tryDirect = async () => {
        if (
          input.type === "mark_on_route" ||
          input.type === "mark_arrived" ||
          input.type === "start_work"
        ) {
          const status = MILESTONE_STATUS[input.type];
          const extra: Record<string, unknown> =
            input.type === "start_work"
              ? {
                  field_lock_active: true,
                  field_lock_started_at: new Date().toISOString(),
                  active_editor_engineer_id: engineerId,
                  pending_sync_flag: true,
                  last_synced_at: new Date().toISOString(),
                }
              : { last_synced_at: new Date().toISOString() };
          const { error: e1 } = await supabase
            .from("work_orders")
            .update({ current_status: status, ...extra })
            .eq("id", workOrderId);
          if (e1) throw e1;
          const { error: e2 } = await supabase
            .from("work_order_events")
            .insert({
              work_order_id: workOrderId,
              event_type: "milestone",
              event_label: MILESTONE_LABEL[input.type],
              event_payload_json: payload as never,
            });
          if (e2) throw e2;
          return;
        }
        if (input.type === "checklist_save") {
          const { error } = await supabase.from("work_order_events").insert({
            work_order_id: workOrderId,
            event_type: "checklist_save",
            event_label: "Checklist progress saved",
            event_payload_json: payload as never,
          });
          if (error) throw error;
          return;
        }
        if (
          input.type === "submit_complete" ||
          input.type === "submit_incomplete"
        ) {
          const status: WorkOrderStatus =
            input.type === "submit_complete"
              ? "field_submitted_complete"
              : "field_submitted_incomplete";
          const { error: e1 } = await supabase
            .from("work_orders")
            .update({
              current_status: status,
              current_outcome_reason:
                input.type === "submit_incomplete"
                  ? ((payload.reason as IncompleteReason) ?? null)
                  : null,
              field_lock_active: false,
              active_editor_engineer_id: null,
              pending_sync_flag: false,
              last_synced_at: new Date().toISOString(),
            })
            .eq("id", workOrderId);
          if (e1) throw e1;
          const { error: e2 } = await supabase
            .from("work_order_events")
            .insert({
              work_order_id: workOrderId,
              event_type: "field_submit",
              event_label:
                input.type === "submit_complete"
                  ? "Engineer submitted job as complete"
                  : "Engineer submitted job as incomplete",
              event_payload_json: payload as never,
            });
          if (e2) throw e2;
          return;
        }
        throw new Error(`Unsupported direct mutation ${input.type}`);
      };

      if (offline) {
        await enqueueMutation({
          work_order_id: workOrderId,
          engineer_id: engineerId,
          type: input.type,
          payload,
        });
        return { queued: true as const };
      }
      try {
        await tryDirect();
        return { queued: false as const };
      } catch (err) {
        await enqueueMutation({
          work_order_id: workOrderId,
          engineer_id: engineerId,
          type: input.type,
          payload: {
            ...payload,
            error: err instanceof Error ? err.message : String(err),
          },
        });
        return { queued: true as const };
      }
    },
    onSuccess: invalidate,
  });
}