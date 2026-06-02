import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { EngineerAvailability } from "@/types/engineers";
import { useCurrentEngineer } from "./useEngineerJobs";

/** Availability rows for the currently-signed-in engineer. */
export function useMyAvailability() {
  const { data: me } = useCurrentEngineer();
  return useQuery({
    queryKey: ["engineer_availability", "me", me?.id],
    enabled: !!me?.id,
    queryFn: async (): Promise<EngineerAvailability[]> => {
      if (!me?.id) return [];
      const { data, error } = await supabase
        .from("engineer_availability")
        .select("*")
        .eq("engineer_id", me.id)
        .order("start_at", { ascending: true, nullsFirst: false });
      if (error) throw error;
      return (data ?? []) as EngineerAvailability[];
    },
  });
}

/** Mark the current engineer as unavailable for a date (or date range). */
export function useSetMyUnavailable() {
  const qc = useQueryClient();
  const { data: me } = useCurrentEngineer();
  return useMutation({
    mutationFn: async (input: {
      startDate: string; // YYYY-MM-DD (local)
      endDate?: string | null; // optional inclusive end date
      note?: string | null;
    }) => {
      if (!me?.id) throw new Error("No engineer profile linked to this account.");
      const start = new Date(`${input.startDate}T00:00:00`);
      const endDay = input.endDate ?? input.startDate;
      // End of last day (exclusive) — store at 23:59:59 so date-range checks include the day.
      const end = new Date(`${endDay}T23:59:59`);
      const { data, error } = await supabase
        .from("engineer_availability")
        .insert({
          engineer_id: me.id,
          availability_type: "unavailable_block",
          start_at: start.toISOString(),
          end_at: end.toISOString(),
          note: input.note ?? null,
        })
        .select()
        .single();
      if (error) throw error;
      return data as EngineerAvailability;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["engineer_availability"] });
    },
  });
}

/** Remove one of my unavailability entries. */
export function useRemoveMyUnavailable() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("engineer_availability")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["engineer_availability"] });
    },
  });
}