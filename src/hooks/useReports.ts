import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { rangeDays } from "@/lib/reportFormatters";

export interface ReportFilters {
  from: string;
  to: string;
  clientId?: string | null;
  trade?: string | null;
  engineerId?: string | null;
  zone?: string | null;
}

export function useReportFilters(initialDays = 30) {
  const init = rangeDays(initialDays);
  const [filters, setFilters] = useState<ReportFilters>({
    from: init.from,
    to: init.to,
    clientId: null,
    trade: null,
    engineerId: null,
    zone: null,
  });
  function setDays(days: number) {
    const r = rangeDays(days);
    setFilters((f) => ({ ...f, from: r.from, to: r.to }));
  }
  return { filters, setFilters, setDays };
}

/* ---------------- Intake ---------------- */

export function useIntakeReports(f: ReportFilters) {
  return useQuery({
    queryKey: ["report.intake", f],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("intake_records")
        .select("id,parse_status,parse_confidence,categorization_confidence,duplicate_confidence,duplicate_candidates_json,source_type,created_at,reviewed_at,converted_work_order_id,rejection_reason")
        .gte("created_at", f.from)
        .lte("created_at", f.to)
        .order("created_at", { ascending: false })
        .limit(1000);
      if (error) throw error;
      return data ?? [];
    },
  });
}

/* ---------------- Operations ---------------- */

export function useOperationsReports(f: ReportFilters) {
  return useQuery({
    queryKey: ["report.operations", f],
    queryFn: async () => {
      let q = supabase
        .from("work_orders")
        .select(`
          id, order_no, current_status, primary_trade, postcode_zone, priority_level,
          client_id, complexity_level, created_at, updated_at, diary_date,
          pending_sync_flag, planner_conflict_flag, field_lock_active,
          parsing_confidence, categorization_confidence, duplicate_flag,
          current_outcome_reason, review_outcome,
          client:clients ( id, client_name ),
          assignments:work_order_assignments ( id, assignment_role, assignment_status, engineer_id )
        `)
        .gte("created_at", f.from)
        .lte("created_at", f.to)
        .order("created_at", { ascending: false })
        .limit(1000);
      if (f.clientId) q = q.eq("client_id", f.clientId);
      if (f.trade) q = q.eq("primary_trade", f.trade);
      if (f.zone) q = q.eq("postcode_zone", f.zone);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useReportLookups() {
  return useQuery({
    queryKey: ["report.lookups"],
    queryFn: async () => {
      const [clients, engineers] = await Promise.all([
        supabase.from("clients").select("id,client_name").eq("active", true).order("client_name"),
        supabase.from("engineers").select("id,display_name").eq("active_status", true).order("display_name"),
      ]);
      if (clients.error) throw clients.error;
      if (engineers.error) throw engineers.error;
      return { clients: clients.data ?? [], engineers: engineers.data ?? [] };
    },
  });
}

/* ---------------- Engineer reports ---------------- */

export function useEngineerReports(f: ReportFilters) {
  return useQuery({
    queryKey: ["report.engineers", f],
    queryFn: async () => {
      const [eng, asg, wo] = await Promise.all([
        supabase.from("engineers").select("id,display_name,engineer_code,active_status"),
        supabase
          .from("work_order_assignments")
          .select("id,work_order_id,engineer_id,assignment_role,assignment_status,assigned_at,updated_at")
          .gte("assigned_at", f.from)
          .lte("assigned_at", f.to)
          .limit(2000),
        supabase
          .from("work_orders")
          .select("id,current_status,current_outcome_reason,created_at,updated_at")
          .gte("created_at", f.from)
          .lte("created_at", f.to)
          .limit(2000),
      ]);
      if (eng.error) throw eng.error;
      if (asg.error) throw asg.error;
      if (wo.error) throw wo.error;
      return { engineers: eng.data ?? [], assignments: asg.data ?? [], workOrders: wo.data ?? [] };
    },
  });
}

/* ---------------- System health ---------------- */

export function useSystemReports(f: ReportFilters) {
  return useQuery({
    queryKey: ["report.system", f],
    queryFn: async () => {
      const [wo, sheet, parsing] = await Promise.all([
        supabase
          .from("work_orders")
          .select("id,order_no,pending_sync_flag,planner_conflict_flag,planner_conflict_message,field_lock_active,last_synced_at,updated_at")
          .limit(2000),
        supabase
          .from("sheet_sync_log")
          .select("id,sync_status,sync_direction,sheet_name,error_message,created_at,synced_at")
          .gte("created_at", f.from)
          .lte("created_at", f.to)
          .order("created_at", { ascending: false })
          .limit(1000),
        supabase
          .from("parsing_reviews")
          .select("id,review_status,issue_type,created_at,resolved_at")
          .gte("created_at", f.from)
          .lte("created_at", f.to)
          .limit(1000),
      ]);
      if (wo.error) throw wo.error;
      if (sheet.error) throw sheet.error;
      if (parsing.error) throw parsing.error;
      return { workOrders: wo.data ?? [], sheetLog: sheet.data ?? [], parsingReviews: parsing.data ?? [] };
    },
  });
}

export function useTradeOptions() {
  return useMemo(
    () => ["heating", "plumbing", "electrical", "gas", "multi-trade", "damp-mould", "drainage"],
    [],
  );
}