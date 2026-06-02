import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { WorkOrderWithRelations } from "@/types/workOrders";

const SELECT = `
  *,
  client:clients ( id, client_name, client_type ),
  assignments:work_order_assignments (
    id, assignment_role, assignment_status,
    engineer:engineers ( id, display_name, engineer_code, contact_number )
  )
`;

function todayBounds() {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  return { startIso: fmt(start), endIso: fmt(end) };
}

/** Jobs where an engineer has started or is en-route / on-site. */
export function useOnSiteWorkOrders() {
  return useQuery({
    queryKey: ["work_orders", "on_site"],
    refetchInterval: 30_000,
    queryFn: async (): Promise<WorkOrderWithRelations[]> => {
      const { data, error } = await supabase
        .from("work_orders")
        .select(SELECT)
        .in("current_status", ["en_route", "on_site", "field_in_progress"])
        .order("updated_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return (data ?? []) as unknown as WorkOrderWithRelations[];
    },
  });
}

/** Today's scheduled jobs that the engineer hasn't actively started yet. */
export function useTodayPlannedNotStarted() {
  return useQuery({
    queryKey: ["work_orders", "today_not_started"],
    refetchInterval: 60_000,
    queryFn: async (): Promise<WorkOrderWithRelations[]> => {
      const { startIso } = todayBounds();
      const { data, error } = await supabase
        .from("work_orders")
        .select(SELECT)
        .eq("diary_date", startIso)
        .in("current_status", ["assigned", "accepted", "scheduled_in_sheet"])
        .order("diary_slot_label", { ascending: true, nullsFirst: false })
        .limit(200);
      if (error) throw error;
      return (data ?? []) as unknown as WorkOrderWithRelations[];
    },
  });
}

/** Completed / closed jobs. */
export function useClosedJobs(limit = 20) {
  return useQuery({
    queryKey: ["work_orders", "closed", limit],
    queryFn: async (): Promise<WorkOrderWithRelations[]> => {
      const { data, error } = await supabase
        .from("work_orders")
        .select(SELECT)
        .eq("current_status", "closed")
        .order("updated_at", { ascending: false })
        .limit(limit);
      if (error) throw error;
      return (data ?? []) as unknown as WorkOrderWithRelations[];
    },
  });
}