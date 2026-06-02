import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { isBlockedOnDate } from "@/lib/availabilityBlocks";
import type { EngineerAvailability } from "@/types/engineers";

export interface AssignmentSavePayload {
  work_order_id: string;
  lead_engineer_id: string;
  support_engineer_ids: string[];
  diary_date: string | null;
  diary_slot_label: string | null;
  engineers_required: number;
}

export function useAssignWorkOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: AssignmentSavePayload) => {
      const { data: u } = await supabase.auth.getUser();
      const actor = u.user?.id ?? null;

      // 0. Availability guard — block save if any chosen engineer is
      //    unavailable on the chosen diary date.
      if (input.diary_date) {
        const ids = [input.lead_engineer_id, ...input.support_engineer_ids].filter(
          Boolean,
        );
        if (ids.length) {
          const { data: slots, error: avErr } = await supabase
            .from("engineer_availability")
            .select("*")
            .in("engineer_id", ids)
            .in("availability_type", ["time_off", "unavailable_block"]);
          if (avErr) throw avErr;

          const blockedNames: string[] = [];
          for (const id of ids) {
            const res = isBlockedOnDate(
              (slots ?? []) as EngineerAvailability[],
              id,
              input.diary_date,
            );
            if (res.blocked) {
              const { data: eng } = await supabase
                .from("engineers")
                .select("display_name")
                .eq("id", id)
                .maybeSingle();
              blockedNames.push(
                `${eng?.display_name ?? id}${res.note ? ` (${res.note})` : ""}`,
              );
            }
          }
          if (blockedNames.length) {
            throw new Error(
              `Cannot assign — engineer unavailable on ${input.diary_date}: ${blockedNames.join("; ")}`,
            );
          }
        }
      }

      // 1. Remove any existing active assignments (clean slate)
      const { error: rmErr } = await supabase
        .from("work_order_assignments")
        .update({ assignment_status: "removed" })
        .eq("work_order_id", input.work_order_id)
        .in("assignment_status", ["assigned", "accepted"]);
      if (rmErr) throw rmErr;

      // 2. Insert lead + supports
      const rows = [
        {
          work_order_id: input.work_order_id,
          engineer_id: input.lead_engineer_id,
          assignment_role: "lead" as const,
          assignment_status: "assigned" as const,
          assigned_by: actor,
        },
        ...input.support_engineer_ids
          .filter((id) => id && id !== input.lead_engineer_id)
          .map((id) => ({
            work_order_id: input.work_order_id,
            engineer_id: id,
            assignment_role: "support" as const,
            assignment_status: "assigned" as const,
            assigned_by: actor,
          })),
      ];
      const { error: insErr } = await supabase
        .from("work_order_assignments")
        .insert(rows);
      if (insErr) throw insErr;

      // 3. Update the work order
      const { error: woErr } = await supabase
        .from("work_orders")
        .update({
          diary_date: input.diary_date,
          diary_slot_label: input.diary_slot_label,
          engineers_required: input.engineers_required,
          current_status: "assigned",
        })
        .eq("id", input.work_order_id);
      if (woErr) throw woErr;

      // 4. Audit event
      await supabase.from("work_order_events").insert({
        work_order_id: input.work_order_id,
        actor_profile_id: actor,
        event_type: "assignment.saved",
        event_label: "Engineers assigned",
        event_payload_json: {
          lead_engineer_id: input.lead_engineer_id,
          support_engineer_ids: input.support_engineer_ids,
          diary_date: input.diary_date,
          diary_slot_label: input.diary_slot_label,
          engineers_required: input.engineers_required,
        },
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["work_orders"] });
    },
  });
}

export function useResolveParsingReview() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { review_id: string; work_order_id: string }) => {
      const { data: u } = await supabase.auth.getUser();
      const actor = u.user?.id ?? null;

      const { error: revErr } = await supabase
        .from("parsing_reviews")
        .update({
          review_status: "resolved",
          resolved_by: actor,
          resolved_at: new Date().toISOString(),
        })
        .eq("id", input.review_id);
      if (revErr) throw revErr;

      const { error: woErr } = await supabase
        .from("work_orders")
        .update({ current_status: "ready_for_dispatch" })
        .eq("id", input.work_order_id);
      if (woErr) throw woErr;

      await supabase.from("work_order_events").insert({
        work_order_id: input.work_order_id,
        actor_profile_id: actor,
        event_type: "parsing_review.resolved",
        event_label: "Parsing review marked resolved",
        event_payload_json: { review_id: input.review_id },
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["parsing_reviews"] });
      qc.invalidateQueries({ queryKey: ["work_orders"] });
    },
  });
}