import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

/**
 * Subscribes to postgres_changes on the core operational tables and invalidates
 * matching React Query caches so any open page auto-updates when data changes.
 * Mounted once under AuthProvider; only active for authenticated users.
 */

type Invalidator = (qc: ReturnType<typeof useQueryClient>, row: Record<string, unknown> | null) => void;

const TABLE_INVALIDATORS: Record<string, Invalidator> = {
  work_orders: (qc) => {
    qc.invalidateQueries({ queryKey: ["work_orders"] });
    qc.invalidateQueries({ queryKey: ["boss", "work_orders"] });
    qc.invalidateQueries({ queryKey: ["diary_planning"] });
    qc.invalidateQueries({ queryKey: ["billing_queue"] });
    qc.invalidateQueries({ queryKey: ["global-search"] });
  },
  work_order_assignments: (qc) => {
    qc.invalidateQueries({ queryKey: ["work_orders"] });
    qc.invalidateQueries({ queryKey: ["work_order_assignments"] });
    qc.invalidateQueries({ queryKey: ["diary_planning"] });
  },
  work_order_events: (qc, row) => {
    const woId = row?.work_order_id as string | undefined;
    if (woId) qc.invalidateQueries({ queryKey: ["work_order_events", woId] });
    qc.invalidateQueries({ queryKey: ["work_orders", "detail"] });
    qc.invalidateQueries({ queryKey: ["boss", "audit"] });
  },
  work_order_files: (qc, row) => {
    const woId = row?.work_order_id as string | undefined;
    if (woId) qc.invalidateQueries({ queryKey: ["work_order_files", woId] });
  },
  work_order_expenses: (qc, row) => {
    const woId = row?.work_order_id as string | undefined;
    if (woId) qc.invalidateQueries({ queryKey: ["work_order_expenses", woId] });
    qc.invalidateQueries({ queryKey: ["billing_case"] });
    qc.invalidateQueries({ queryKey: ["billing_queue"] });
  },
  work_order_external_contacts: (qc, row) => {
    const woId = row?.work_order_id as string | undefined;
    if (woId) qc.invalidateQueries({ queryKey: ["wo_external_contacts", woId] });
    qc.invalidateQueries({ queryKey: ["wo_external_contacts"] });
  },
  billing_cases: (qc) => {
    qc.invalidateQueries({ queryKey: ["billing_queue"] });
    qc.invalidateQueries({ queryKey: ["billing_case"] });
  },
  billing_status_events: (qc) => {
    qc.invalidateQueries({ queryKey: ["billing_status_events"] });
    qc.invalidateQueries({ queryKey: ["billing_queue"] });
  },
  billing_adjustments: (qc) => {
    qc.invalidateQueries({ queryKey: ["billing_adjustments"] });
    qc.invalidateQueries({ queryKey: ["billing_queue"] });
  },
  profiles: (qc) => {
    qc.invalidateQueries({ queryKey: ["people", "directory"] });
    qc.invalidateQueries({ queryKey: ["contacts"] });
    qc.invalidateQueries({ queryKey: ["boss", "staff"] });
  },
  engineers: (qc) => {
    qc.invalidateQueries({ queryKey: ["engineers"] });
    qc.invalidateQueries({ queryKey: ["people", "directory"] });
  },
  engineer_availability: (qc) => {
    qc.invalidateQueries({ queryKey: ["diary_planning"] });
  },
  external_contacts: (qc) => {
    qc.invalidateQueries({ queryKey: ["external_contacts"] });
    qc.invalidateQueries({ queryKey: ["people", "directory"] });
    qc.invalidateQueries({ queryKey: ["contacts"] });
  },
  clients: (qc) => {
    qc.invalidateQueries({ queryKey: ["clients"] });
  },
  user_contact_profiles: (qc) => {
    qc.invalidateQueries({ queryKey: ["contacts"] });
    qc.invalidateQueries({ queryKey: ["people", "directory"] });
    qc.invalidateQueries({ queryKey: ["dm", "my-contact-profile"] });
  },
  intake_records: (qc) => {
    qc.invalidateQueries({ queryKey: ["intake_records"] });
  },
  parsing_reviews: (qc) => {
    qc.invalidateQueries({ queryKey: ["parsing_reviews"] });
  },
  parsing_review_actions: (qc, row) => {
    const id = row?.intake_record_id as string | undefined;
    if (id) qc.invalidateQueries({ queryKey: ["parsing_review_actions", id] });
  },
  communication_log_entries: (qc, row) => {
    const woId = row?.work_order_id as string | undefined;
    if (woId) qc.invalidateQueries({ queryKey: ["wo_communications", woId] });
    qc.invalidateQueries({ queryKey: ["follow_up_queue"] });
  },
  recommendations: (qc) => {
    qc.invalidateQueries({ queryKey: ["recommendations_state"] });
  },
  boss_audit_log: (qc) => {
    qc.invalidateQueries({ queryKey: ["boss", "audit"] });
  },
  sheet_sync_log: (qc) => {
    qc.invalidateQueries({ queryKey: ["sheet_sync_log"] });
  },
};

export function RealtimeSync() {
  const qc = useQueryClient();
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;

    const channel = supabase.channel("realtime-sync-global");

    for (const table of Object.keys(TABLE_INVALIDATORS)) {
      channel.on(
        "postgres_changes",
        { event: "*", schema: "public", table },
        (payload) => {
          const fn = TABLE_INVALIDATORS[table];
          const row =
            (payload.new as Record<string, unknown> | null) ??
            (payload.old as Record<string, unknown> | null) ??
            null;
          try {
            fn(qc, row);
          } catch {
            /* noop */
          }
        },
      );
    }

    channel.subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [qc, user]);

  return null;
}