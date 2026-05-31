import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEngineers } from "./useEngineers";
import { useAllAvailability } from "./useEngineerAvailability";
import {
  buildAssignmentSuggestion,
  buildMatchContext,
  type AssignmentSuggestion,
  type MatchContext,
} from "@/lib/engineerMatching";
import type { IntakeRecord } from "@/types/intake";
import type { WorkOrderAssignment } from "@/types/engineers";

/** Active assignments across all work orders — used to gauge engineer load. */
function useActiveAssignments() {
  return useQuery({
    queryKey: ["work_order_assignments", "active"],
    queryFn: async (): Promise<WorkOrderAssignment[]> => {
      const { data, error } = await supabase
        .from("work_order_assignments")
        .select("*")
        .in("assignment_status", ["assigned", "accepted"]);
      if (error) throw error;
      return (data ?? []) as WorkOrderAssignment[];
    },
    staleTime: 30_000,
  });
}

export interface UseAssignmentSuggestionsArgs {
  record: IntakeRecord | null;
  /** Live draft override of extracted fields (from the drawer editor). */
  overrides?: Partial<MatchContext>;
}

export interface UseAssignmentSuggestionsResult {
  suggestion: AssignmentSuggestion | null;
  isLoading: boolean;
  context: MatchContext | null;
}

export function useAssignmentSuggestions({
  record,
  overrides,
}: UseAssignmentSuggestionsArgs): UseAssignmentSuggestionsResult {
  const engineersQ = useEngineers();
  const availabilityQ = useAllAvailability();
  const assignmentsQ = useActiveAssignments();

  const suggestion = useMemo<AssignmentSuggestion | null>(() => {
    if (!record) return null;
    if (!engineersQ.data) return null;
    const base = buildMatchContext(record);
    const ctx: MatchContext = { ...base, ...(overrides ?? {}) };
    return buildAssignmentSuggestion(
      engineersQ.data.filter((e) => e.active_status),
      availabilityQ.data ?? [],
      assignmentsQ.data ?? [],
      ctx,
    );
  }, [record, engineersQ.data, availabilityQ.data, assignmentsQ.data, overrides]);

  return {
    suggestion,
    isLoading: engineersQ.isLoading || availabilityQ.isLoading || assignmentsQ.isLoading,
    context: suggestion?.context ?? null,
  };
}