import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type {
  WorkOrderStatus,
  WorkOrderWithRelations,
  ReviewOutcome,
  IncompleteReason,
} from "@/types/workOrders";
import { REVIEW_STATUSES } from "@/types/workOrders";

const SELECT = `
  *,
  client:clients ( id, client_name, client_type ),
  assignments:work_order_assignments (
    id, assignment_role, assignment_status,
    engineer:engineers ( id, display_name, engineer_code )
  )
`;

export interface WorkOrderEvent {
  id: string;
  work_order_id: string;
  event_type: string;
  event_label: string | null;
  event_payload_json: Record<string, unknown> | null;
  actor_profile_id: string | null;
  actor_engineer_id: string | null;
  created_at: string;
}

export interface FieldSubmission {
  outcome: "complete" | "incomplete";
  reason: IncompleteReason | null;
  notes: string | null;
  advisory_notes: string | null;
  checklist: Record<string, boolean> | null;
  evidence: { arrival?: boolean; before_leaving?: boolean; signature?: boolean } | null;
  submitted_at: string;
}

export function usePostCompletionQueue() {
  return useQuery({
    queryKey: ["work_orders", "post_completion_queue"],
    queryFn: async (): Promise<WorkOrderWithRelations[]> => {
      const { data, error } = await supabase
        .from("work_orders")
        .select(SELECT)
        .in("current_status", REVIEW_STATUSES)
        .order("updated_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data ?? []) as unknown as WorkOrderWithRelations[];
    },
  });
}

export function useWorkOrderEvents(workOrderId: string | null) {
  return useQuery({
    queryKey: ["work_order_events", workOrderId],
    enabled: !!workOrderId,
    queryFn: async (): Promise<WorkOrderEvent[]> => {
      if (!workOrderId) return [];
      const { data, error } = await supabase
        .from("work_order_events")
        .select(
          "id, work_order_id, event_type, event_label, event_payload_json, actor_profile_id, actor_engineer_id, created_at",
        )
        .eq("work_order_id", workOrderId)
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data ?? []) as unknown as WorkOrderEvent[];
    },
  });
}

/** Extract the most recent engineer field submission from the event timeline. */
export function extractFieldSubmission(events: WorkOrderEvent[]): FieldSubmission | null {
  const submit = events.find((e) => e.event_type === "field_submit");
  if (!submit) return null;
  const p = (submit.event_payload_json ?? {}) as Record<string, unknown>;
  const outcomeRaw = typeof p.outcome === "string" ? p.outcome : null;
  const outcome: "complete" | "incomplete" =
    outcomeRaw === "incomplete" ? "incomplete" : "complete";
  return {
    outcome,
    reason: (p.reason as IncompleteReason | null) ?? null,
    notes: typeof p.notes === "string" ? p.notes : null,
    advisory_notes:
      typeof p.advisory_notes === "string" ? p.advisory_notes : null,
    checklist: (p.checklist as Record<string, boolean> | null) ?? null,
    evidence:
      (p.evidence as FieldSubmission["evidence"]) ?? null,
    submitted_at: submit.created_at,
  };
}

export interface ReviewActionInput {
  work_order_id: string;
  review_outcome: ReviewOutcome;
  next_status: WorkOrderStatus;
  note: string;
  follow_up_tags?: string[];
}

/**
 * Dispatcher review action. Writes the work_orders row (status + review_outcome
 * + admin note append) and appends a `review_action` event for audit. Engineer's
 * original `field_submit` event is never mutated — accountability is preserved.
 */
export function useReviewAction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: ReviewActionInput) => {
      const { data: userData } = await supabase.auth.getUser();
      const actor = userData.user?.id ?? null;

      // Append to admin_notes rather than overwrite — keep history readable.
      const { data: existing } = await supabase
        .from("work_orders")
        .select("admin_notes")
        .eq("id", input.work_order_id)
        .maybeSingle();

      const stamp = new Date().toISOString().slice(0, 16).replace("T", " ");
      const appended =
        (existing?.admin_notes ? `${existing.admin_notes}\n\n` : "") +
        `[${stamp}] Review · ${input.review_outcome}: ${input.note}`;

      const { error: e1 } = await supabase
        .from("work_orders")
        .update({
          current_status: input.next_status,
          review_outcome: input.review_outcome,
          admin_notes: appended,
        })
        .eq("id", input.work_order_id);
      if (e1) throw e1;

      const { error: e2 } = await supabase
        .from("work_order_events")
        .insert({
          work_order_id: input.work_order_id,
          event_type: "review_action",
          event_label: `Dispatcher review: ${input.review_outcome}`,
          actor_profile_id: actor,
          event_payload_json: {
            review_outcome: input.review_outcome,
            next_status: input.next_status,
            note: input.note,
            follow_up_tags: input.follow_up_tags ?? [],
          } as never,
        });
      if (e2) throw e2;
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["work_orders"] });
      qc.invalidateQueries({ queryKey: ["work_orders", "post_completion_queue"] });
      qc.invalidateQueries({ queryKey: ["work_order_events", vars.work_order_id] });
    },
  });
}