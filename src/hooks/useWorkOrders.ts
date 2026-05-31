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
  | "order_no"
  | "client_id"
  | "address_line_1"
  | "postcode"
  | "job_summary"
  | "job_description"
  | "primary_trade"
  | "complexity_level"
  | "priority_level"
  | "estimated_duration_minutes"
  | "estimated_value_amount"
>;

export function useCreateWorkOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateWorkOrderInput) => {
      const { data: userData } = await supabase.auth.getUser();
      const { data, error } = await supabase
        .from("work_orders")
        .insert({
          ...input,
          source_channel: "manual_entry",
          current_status: "ready_for_dispatch",
          created_by: userData.user?.id ?? null,
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["work_orders"] });
    },
  });
}