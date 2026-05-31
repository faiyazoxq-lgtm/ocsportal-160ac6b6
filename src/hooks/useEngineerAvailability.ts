import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { EngineerAvailability, EngineerAvailabilityInput } from "@/types/engineers";

export function useEngineerAvailability(engineerId: string | null) {
  return useQuery({
    queryKey: ["engineer_availability", engineerId],
    enabled: !!engineerId,
    queryFn: async (): Promise<EngineerAvailability[]> => {
      if (!engineerId) return [];
      const { data, error } = await supabase
        .from("engineer_availability")
        .select("*")
        .eq("engineer_id", engineerId)
        .order("start_at", { ascending: false, nullsFirst: false });
      if (error) throw error;
      return (data ?? []) as EngineerAvailability[];
    },
  });
}

export function useAllAvailability() {
  return useQuery({
    queryKey: ["engineer_availability", "all"],
    queryFn: async (): Promise<EngineerAvailability[]> => {
      const { data, error } = await supabase
        .from("engineer_availability")
        .select("*");
      if (error) throw error;
      return (data ?? []) as EngineerAvailability[];
    },
  });
}

export function useAddAvailability() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: EngineerAvailabilityInput) => {
      const { data: u } = await supabase.auth.getUser();
      const { data, error } = await supabase
        .from("engineer_availability")
        .insert({
          engineer_id: input.engineer_id,
          availability_type: input.availability_type,
          start_at: input.start_at ?? null,
          end_at: input.end_at ?? null,
          weekday_rule: input.weekday_rule ?? null,
          note: input.note ?? null,
          created_by: u.user?.id ?? null,
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ["engineer_availability", v.engineer_id] });
      qc.invalidateQueries({ queryKey: ["engineer_availability", "all"] });
    },
  });
}

export function useDeleteAvailability() {
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