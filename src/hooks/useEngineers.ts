import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Engineer, EngineerInput } from "@/types/engineers";

export function useEngineers() {
  return useQuery({
    queryKey: ["engineers"],
    queryFn: async (): Promise<Engineer[]> => {
      const { data, error } = await supabase
        .from("engineers")
        .select("*")
        .order("display_name");
      if (error) throw error;
      return (data ?? []) as Engineer[];
    },
  });
}

export function useUpsertEngineer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: EngineerInput & { id?: string }) => {
      const payload = {
        display_name: input.display_name.trim(),
        engineer_code: input.engineer_code || null,
        primary_trade: input.primary_trade || null,
        trade_tags: input.trade_tags,
        certification_tags: input.certification_tags,
        covered_postcode_zones: input.covered_postcode_zones,
        complexity_cap: input.complexity_cap,
        can_lead: input.can_lead,
        can_support: input.can_support,
        active_status: input.active_status,
        notes: input.notes || null,
      };
      if (input.id) {
        const { data, error } = await supabase
          .from("engineers")
          .update(payload)
          .eq("id", input.id)
          .select()
          .single();
        if (error) throw error;
        return data;
      } else {
        const { data, error } = await supabase
          .from("engineers")
          .insert(payload)
          .select()
          .single();
        if (error) throw error;
        return data;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["engineers"] }),
  });
}