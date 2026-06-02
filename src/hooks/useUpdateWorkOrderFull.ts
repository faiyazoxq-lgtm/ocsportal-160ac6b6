import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { WorkOrder } from "@/types/workOrders";

export type FullEditableWorkOrder = Partial<
  Pick<
    WorkOrder,
    | "client_id"
    | "order_no"
    | "address_line_1"
    | "address_line_2"
    | "city"
    | "postcode"
    | "postcode_zone"
    | "job_summary"
    | "job_description"
    | "primary_trade"
    | "complexity_level"
    | "priority_level"
    | "estimated_duration_minutes"
    | "estimated_value_amount"
    | "engineers_required"
    | "tools_materials_hint"
    | "diary_date"
    | "diary_slot_label"
    | "admin_notes"
    | "current_status"
    | "private_notes"
    | "tenant_contact_id"
    | "tenant_name"
    | "tenant_phone"
    | "tenant_email"
    | "tenant_notes"
  >
>;

/**
 * Dispatcher/Boss full-field work-order edit. RLS already restricts writes
 * to dispatchers and boss. Audit row logged to work_order_events; if the
 * caller is boss, a boss_audit_log row is also written.
 */
export function useUpdateWorkOrderFull(workOrderId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (patch: FullEditableWorkOrder) => {
      const { data: u } = await supabase.auth.getUser();
      const userId = u.user?.id ?? null;

      // Snapshot before for audit
      const { data: before } = await supabase
        .from("work_orders")
        .select("*")
        .eq("id", workOrderId)
        .maybeSingle();

      const { error } = await supabase
        .from("work_orders")
        .update(patch)
        .eq("id", workOrderId);
      if (error) throw error;

      await supabase.from("work_order_events").insert({
        work_order_id: workOrderId,
        event_type: "dispatcher_edit",
        event_label: "Work order edited",
        event_payload_json: { fields: Object.keys(patch) } as never,
        actor_profile_id: userId,
      });

      // Best-effort boss audit (RLS will silently no-op for non-boss callers)
      if (userId) {
        await supabase
          .from("boss_audit_log")
          .insert({
            actor_profile_id: userId,
            action_type: "job_edited",
            target_type: "work_order",
            target_id: workOrderId,
            before_json: (before ?? {}) as never,
            after_json: patch as never,
          })
          .then(() => undefined, () => undefined);
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["work_orders"] });
      qc.invalidateQueries({ queryKey: ["work_orders", "detail", workOrderId] });
      qc.invalidateQueries({ queryKey: ["engineer", "jobs"] });
      qc.invalidateQueries({ queryKey: ["engineer", "jobs", "detail", workOrderId] });
      qc.invalidateQueries({ queryKey: ["work_orders", "field_edits", workOrderId] });
    },
  });
}