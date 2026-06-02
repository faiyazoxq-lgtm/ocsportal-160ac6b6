import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type {
  WorkOrderStatus,
  WorkOrderWithRelations,
  WorkOrder,
} from "@/types/workOrders";

const SELECT_WITH_RELATIONS = `
  *,
  client:clients ( id, client_name, client_type ),
  assignments:work_order_assignments (
    id, assignment_role, assignment_status,
    engineer:engineers ( id, display_name, engineer_code )
  )
`;

export function useWorkOrders(statuses: WorkOrderStatus[], opts?: { key?: string }) {
  return useQuery({
    queryKey: ["work_orders", opts?.key ?? statuses.join(",")],
    queryFn: async (): Promise<WorkOrderWithRelations[]> => {
      const { data, error } = await supabase
        .from("work_orders")
        .select(SELECT_WITH_RELATIONS)
        .in("current_status", statuses)
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data ?? []) as unknown as WorkOrderWithRelations[];
    },
  });
}

export function useWorkOrder(id: string | null) {
  return useQuery({
    queryKey: ["work_orders", "detail", id],
    enabled: !!id,
    queryFn: async (): Promise<WorkOrderWithRelations | null> => {
      if (!id) return null;
      const { data, error } = await supabase
        .from("work_orders")
        .select(SELECT_WITH_RELATIONS)
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      return (data as unknown as WorkOrderWithRelations) ?? null;
    },
  });
}

export type CreateWorkOrderInput = Pick<
  WorkOrder,
  | "client_id"
  | "address_line_1"
  | "address_line_2"
  | "city"
  | "postcode"
  | "job_summary"
  | "job_description"
  | "priority_level"
  | "estimated_duration_minutes"
  | "estimated_value_amount"
> & {
  order_no?: string | null;
  contact_name?: string | null;
  contact_phone?: string | null;
  diary_date?: string | null;
  diary_slot_label?: string | null;
  schedule_notes?: string | null;
};

const REQUIRED_FIELDS: { key: keyof CreateWorkOrderInput; label: string }[] = [
  { key: "client_id", label: "client" },
  { key: "address_line_1", label: "address_line_1" },
  { key: "postcode", label: "postcode" },
  { key: "job_summary", label: "job_summary" },
];

function findMissingFields(input: CreateWorkOrderInput): string[] {
  return REQUIRED_FIELDS.filter((f) => {
    const v = input[f.key];
    return v === null || v === undefined || (typeof v === "string" && v.trim() === "");
  }).map((f) => f.label);
}

export function useCreateWorkOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateWorkOrderInput) => {
      const { data: userData } = await supabase.auth.getUser();
      const { contact_name, contact_phone, order_no, ...rest } = input;
      const cleanOrderNo = (order_no ?? "").trim();
      // Pass blank order_no so the DB trigger auto-generates the final value.
      const woInput = { ...rest, order_no: cleanOrderNo };
      const missing = findMissingFields(input);
      const needsAttention = missing.length > 0;
      const { data, error } = await supabase
        .from("work_orders")
        .insert({
          ...woInput,
          source_channel: "manual_entry",
          current_status: needsAttention ? "admin_attention" : "ready_for_dispatch",
          created_by: userData.user?.id ?? null,
        })
        .select()
        .single();
      if (error) throw error;

      if (needsAttention && data?.id) {
        await supabase.from("parsing_reviews").insert({
          work_order_id: data.id,
          issue_type: "missing_required_fields",
          issue_summary: `Missing key info: ${missing.join(", ")}`,
          missing_fields_json: missing as never,
          confidence_snapshot_json: { source: "manual_entry" } as never,
          review_status: "open",
        } as never);
        await supabase.from("work_order_events").insert({
          work_order_id: data.id,
          event_type: "parse_flag",
          event_label: "Flagged for admin attention — missing key info",
          event_payload_json: { missing_fields: missing } as never,
        } as never);
      }

      // Optional: enrich the linked client with contact info if provided and missing
      if ((contact_name || contact_phone) && input.client_id) {
        await supabase
          .from("clients")
          .update({
            contact_name: contact_name || undefined,
            contact_phone: contact_phone || undefined,
          })
          .eq("id", input.client_id);
      }
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["work_orders"] });
      qc.invalidateQueries({ queryKey: ["clients"] });
    },
  });
}

export function useDeleteWorkOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("work_orders").delete().eq("id", id);
      if (error) throw error;
      return id;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["work_orders"] });
    },
  });
}

export function useConfirmClientForWorkOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data: userData } = await supabase.auth.getUser();
      const { error } = await supabase
        .from("work_orders")
        .update({ current_status: "ready_for_dispatch" })
        .eq("id", id);
      if (error) throw error;
      // Best-effort audit event; ignore if events table is unavailable.
      try {
        await supabase.from("work_order_events").insert({
          work_order_id: id,
          event_type: "client_confirmed",
          event_label: "Telephone client confirmation logged — ready for dispatch",
          event_payload_json: { actor: userData.user?.id ?? null } as never,
        } as never);
      } catch {
        /* noop */
      }
      return id;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["work_orders"] });
    },
  });
}