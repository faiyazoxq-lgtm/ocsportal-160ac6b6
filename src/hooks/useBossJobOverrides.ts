import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import {
  bossOverrideWorkOrder,
  bossOverrideAssignment,
} from "@/lib/boss.functions";
import type { BossAuditEntry } from "@/types/boss";

export function useBossAuditLog(limit = 200) {
  return useQuery({
    queryKey: ["boss", "audit", limit],
    queryFn: async (): Promise<BossAuditEntry[]> => {
      const { data, error } = await supabase
        .from("boss_audit_log")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(limit);
      if (error) throw error;
      return (data ?? []) as unknown as BossAuditEntry[];
    },
  });
}

export function useBossAllWorkOrders() {
  return useQuery({
    queryKey: ["boss", "work_orders"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("work_orders")
        .select(
          "id,order_no,current_status,priority_level,client_id,job_summary,diary_date,scheduled_start_at,address_line_1,city,postcode,field_lock_active,updated_at,created_at",
        )
        .order("updated_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useBossJobOverrides() {
  const qc = useQueryClient();
  const override = useServerFn(bossOverrideWorkOrder);
  const overrideAssign = useServerFn(bossOverrideAssignment);
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["boss", "work_orders"] });
    qc.invalidateQueries({ queryKey: ["boss", "audit"] });
  };
  return {
    overrideWorkOrder: useMutation({
      mutationFn: (input: Parameters<typeof override>[0]["data"]) =>
        override({ data: input }),
      onSuccess: invalidate,
    }),
    overrideAssignment: useMutation({
      mutationFn: (input: Parameters<typeof overrideAssign>[0]["data"]) =>
        overrideAssign({ data: input }),
      onSuccess: invalidate,
    }),
  };
}