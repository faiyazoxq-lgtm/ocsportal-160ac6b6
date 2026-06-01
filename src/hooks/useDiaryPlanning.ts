import { useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import type { WorkOrderWithRelations, WorkOrderStatus, WorkOrder } from "@/types/workOrders";
import type { EngineerAvailability } from "@/types/engineers";

const WO_SELECT = `
  *,
  client:clients ( id, client_name, client_type ),
  assignments:work_order_assignments (
    id, assignment_role, assignment_status,
    engineer:engineers ( id, display_name, engineer_code )
  )
`;

/** Statuses considered "plannable" — exclude closed/cancelled/in-flight field-locked. */
const PLANNABLE_STATUSES: WorkOrderStatus[] = [
  "categorized",
  "ready_for_dispatch",
  "scheduled_in_sheet",
  "assigned",
  "accepted",
];

export interface DiaryPlanningFilters {
  fromDate: string;
  toDate: string;
  trade?: string | null;
  zone?: string | null;
  engineerId?: string | null;
}

export function useScheduledJobs(filters: DiaryPlanningFilters) {
  return useQuery({
    queryKey: ["diary_planning", "scheduled", filters],
    queryFn: async (): Promise<WorkOrderWithRelations[]> => {
      let q = supabase
        .from("work_orders")
        .select(WO_SELECT)
        .gte("diary_date", filters.fromDate)
        .lte("diary_date", filters.toDate)
        .order("diary_date", { ascending: true })
        .order("scheduled_start_at", { ascending: true, nullsFirst: true })
        .limit(500);
      if (filters.trade) q = q.eq("primary_trade", filters.trade);
      if (filters.zone) q = q.eq("postcode_zone", filters.zone);
      const { data, error } = await q;
      if (error) throw error;
      let rows = (data ?? []) as unknown as WorkOrderWithRelations[];
      if (filters.engineerId) {
        rows = rows.filter((w) =>
          w.assignments?.some((a) => a.engineer?.id === filters.engineerId),
        );
      }
      return rows;
    },
  });
}

export function useUnscheduledJobs(filters?: { trade?: string | null; zone?: string | null }) {
  return useQuery({
    queryKey: ["diary_planning", "unscheduled", filters],
    queryFn: async (): Promise<WorkOrderWithRelations[]> => {
      let q = supabase
        .from("work_orders")
        .select(WO_SELECT)
        .in("current_status", PLANNABLE_STATUSES)
        .is("diary_date", null)
        .order("priority_level", { ascending: false })
        .order("created_at", { ascending: true })
        .limit(200);
      if (filters?.trade) q = q.eq("primary_trade", filters.trade);
      if (filters?.zone) q = q.eq("postcode_zone", filters.zone);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as unknown as WorkOrderWithRelations[];
    },
  });
}

export interface ScheduleJobPayload {
  work_order_id: string;
  diary_date: string | null;
  diary_slot_label?: string | null;
  scheduled_start_at?: string | null;
  scheduled_end_at?: string | null;
  diary_slot_status?: "planned" | "confirmed" | "tentative" | "cancelled" | null;
  schedule_notes?: string | null;
  estimated_duration_minutes?: number | null;
  isReschedule?: boolean;
}

export function useScheduleJob() {
  const qc = useQueryClient();
  const { profile } = useAuth();
  return useMutation({
    mutationFn: async (input: ScheduleJobPayload) => {
      // Guard: dispatcher/boss may reschedule even while engineer is on site;
      // only block when the job is closed or cancelled.
      const { data: wo, error: woErr } = await supabase
        .from("work_orders")
        .select("id, current_status")
        .eq("id", input.work_order_id)
        .single();
      if (woErr) throw woErr;
      if (["closed", "cancelled"].includes(wo.current_status)) {
        throw new Error("Job is closed/cancelled — cannot reschedule.");
      }

      const patch: Partial<WorkOrder> = {
        diary_date: input.diary_date,
      };
      if (input.diary_slot_label !== undefined) patch.diary_slot_label = input.diary_slot_label;
      if (input.scheduled_start_at !== undefined) patch.scheduled_start_at = input.scheduled_start_at;
      if (input.scheduled_end_at !== undefined) patch.scheduled_end_at = input.scheduled_end_at;
      if (input.diary_slot_status !== undefined) patch.diary_slot_status = input.diary_slot_status;
      if (input.schedule_notes !== undefined) patch.schedule_notes = input.schedule_notes;
      if (input.estimated_duration_minutes !== undefined)
        patch.estimated_duration_minutes = input.estimated_duration_minutes;
      if (input.isReschedule) {
        patch.rescheduled_at = new Date().toISOString();
        patch.rescheduled_by = profile?.id ?? null;
      }
      const { error } = await supabase
        .from("work_orders")
        .update(patch)
        .eq("id", input.work_order_id);
      if (error) throw error;

      await supabase.from("work_order_events").insert({
        work_order_id: input.work_order_id,
        actor_profile_id: profile?.id ?? null,
        event_type: input.isReschedule ? "diary.rescheduled" : "diary.scheduled",
        event_label: input.isReschedule ? "Job rescheduled" : "Job scheduled",
        event_payload_json: JSON.parse(JSON.stringify(patch)),
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["diary_planning"] });
      qc.invalidateQueries({ queryKey: ["work_orders"] });
    },
  });
}

export interface EngineerCapacity {
  engineerId: string;
  date: string;
  scheduledMinutes: number;
  jobCount: number;
  unavailable: boolean;
  unavailableNote?: string | null;
  conflicts: string[]; // human-readable
}

export function useEngineerCapacity(
  jobs: WorkOrderWithRelations[],
  engineerIds: string[],
  dates: string[],
  availability: EngineerAvailability[],
) {
  return useMemo(() => {
    const map = new Map<string, EngineerCapacity>();
    for (const eid of engineerIds) {
      for (const date of dates) {
        const key = `${eid}|${date}`;
        map.set(key, {
          engineerId: eid,
          date,
          scheduledMinutes: 0,
          jobCount: 0,
          unavailable: false,
          conflicts: [],
        });
      }
    }
    // sum scheduled jobs
    for (const j of jobs) {
      if (!j.diary_date) continue;
      for (const a of j.assignments ?? []) {
        if (!a.engineer || !["assigned", "accepted"].includes(a.assignment_status)) continue;
        const key = `${a.engineer.id}|${j.diary_date}`;
        const entry = map.get(key);
        if (!entry) continue;
        entry.jobCount += 1;
        entry.scheduledMinutes += j.estimated_duration_minutes ?? 60;
      }
    }
    // apply availability (time_off / unavailable_block intersecting date)
    for (const av of availability) {
      if (av.availability_type === "working_hours") continue;
      const start = av.start_at ? av.start_at.slice(0, 10) : null;
      const end = av.end_at ? av.end_at.slice(0, 10) : start;
      for (const date of dates) {
        if (start && end && date >= start && date <= end) {
          const key = `${av.engineer_id}|${date}`;
          const e = map.get(key);
          if (e) {
            e.unavailable = true;
            e.unavailableNote = av.note ?? av.availability_type;
          }
        }
      }
    }
    // detect conflicts: unavailable but has jobs, or over 480 min capacity
    for (const entry of map.values()) {
      if (entry.unavailable && entry.jobCount > 0) {
        entry.conflicts.push(`Engineer unavailable (${entry.unavailableNote ?? "off"})`);
      }
      if (entry.scheduledMinutes > 480) {
        entry.conflicts.push(`Over capacity (${entry.scheduledMinutes} min)`);
      }
    }
    return map;
  }, [jobs, engineerIds, dates, availability]);
}

/** Detect job-level scheduling issues. */
export function findJobIssues(j: WorkOrderWithRelations): string[] {
  const issues: string[] = [];
  const active = (j.assignments ?? []).filter((a) =>
    ["assigned", "accepted"].includes(a.assignment_status),
  );
  if (j.engineers_required > 0 && active.length === 0) {
    issues.push("No engineer assigned");
  }
  if (active.length > 0 && !active.some((a) => a.assignment_role === "lead")) {
    issues.push("No lead engineer");
  }
  if (j.diary_date && active.length < j.engineers_required) {
    issues.push(`Needs ${j.engineers_required} engineers, has ${active.length}`);
  }
  if (j.diary_date && !j.estimated_duration_minutes) {
    issues.push("Missing duration estimate");
  }
  return issues;
}