import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Engineer-side "Stop Work" — reverts an in-progress job back to `on_site`
 * so the engineer jobs page shows the "Start work" affordance again.
 * Logs an auditable work_order_events row and clears the field-lock flags.
 */
export function useStopWorkOrder(workOrderId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (note?: string) => {
      const { error: e1 } = await supabase
        .from("work_orders")
        .update({
          current_status: "on_site",
          field_lock_active: false,
          active_editor_engineer_id: null,
          pending_sync_flag: false,
          last_synced_at: new Date().toISOString(),
        })
        .eq("id", workOrderId);
      if (e1) throw e1;
      const { error: e2 } = await supabase.from("work_order_events").insert({
        work_order_id: workOrderId,
        event_type: "milestone",
        event_label: "Engineer stopped work",
        event_payload_json: { milestone: "stop_work", note: note ?? null } as never,
      });
      if (e2) throw e2;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["engineer", "jobs"] });
      qc.invalidateQueries({
        queryKey: ["engineer", "jobs", "detail", workOrderId],
      });
      qc.invalidateQueries({ queryKey: ["work_orders"] });
    },
  });
}