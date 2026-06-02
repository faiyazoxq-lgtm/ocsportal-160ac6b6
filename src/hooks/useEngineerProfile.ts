import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Engineer, EngineerInput } from "@/types/engineers";

/** Fetch the engineer row linked to a profile (auth user) id. */
export function useEngineerProfile(profileId: string | null) {
  return useQuery({
    queryKey: ["engineer_profile", profileId],
    enabled: !!profileId,
    queryFn: async (): Promise<Engineer | null> => {
      if (!profileId) return null;
      const { data, error } = await supabase
        .from("engineers")
        .select("*")
        .eq("profile_id", profileId)
        .maybeSingle();
      if (error) throw error;
      return (data as Engineer | null) ?? null;
    },
  });
}

/** Create or update the engineer row for a given profile id. */
export function useUpsertEngineerProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: {
      profileId: string;
      displayName: string;
      existingId?: string | null;
      input: EngineerInput;
    }) => {
      const payload = {
        profile_id: args.profileId,
        display_name: args.displayName,
        engineer_code: args.input.engineer_code || null,
        trade_tags: args.input.trade_tags,
        certification_tags: args.input.certification_tags,
        covered_postcode_zones: args.input.covered_postcode_zones,
        can_lead: args.input.can_lead,
        can_support: args.input.can_support,
        active_status: args.input.active_status,
        notes: args.input.notes || null,
      };
      if (args.existingId) {
        const { error } = await supabase
          .from("engineers")
          .update(payload)
          .eq("id", args.existingId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("engineers").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ["engineer_profile", v.profileId] });
      qc.invalidateQueries({ queryKey: ["engineers"] });
      qc.invalidateQueries({ queryKey: ["people", "directory"] });
    },
  });
}