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
      const rows = (data ?? []) as Engineer[];
      const ids = rows.map((r) => r.id);
      if (ids.length) {
        const { data: priv } = await supabase
          .from("engineers_private")
          .select("engineer_id, personal_email, contact_number, hourly_pay_rate, van_registration")
          .in("engineer_id", ids);
        const m = new Map(
          (priv ?? []).map((p: any) => [p.engineer_id as string, p]),
        );
        for (const r of rows) {
          const p = m.get(r.id) as any;
          if (p) {
            r.personal_email = p.personal_email;
            r.contact_number = p.contact_number;
            r.hourly_pay_rate = p.hourly_pay_rate;
            r.van_registration = p.van_registration;
          }
        }
      }
      return rows;
    },
  });
}

export function useUpsertEngineer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: EngineerInput & { id?: string }) => {
      const basePayload = {
        display_name: input.display_name.trim(),
        engineer_code: input.engineer_code || null,
        trade_tags: input.trade_tags,
        certification_tags: input.certification_tags,
        covered_postcode_zones: input.covered_postcode_zones,
        can_lead: input.can_lead,
        can_support: input.can_support,
        active_status: input.active_status,
        notes: input.notes || null,
        avatar_url: input.avatar_url ?? null,
      };
      const privatePayload = {
        personal_email: input.personal_email ?? null,
        contact_number: input.contact_number ?? null,
        hourly_pay_rate:
          input.hourly_pay_rate === undefined || input.hourly_pay_rate === null
            ? null
            : Number(input.hourly_pay_rate),
        van_registration: input.van_registration ?? null,
      };
      let engineerId: string;
      if (input.id) {
        const { data, error } = await supabase
          .from("engineers")
          .update(basePayload)
          .eq("id", input.id)
          .select()
          .single();
        if (error) throw error;
        engineerId = (data as any).id as string;
      } else {
        const { data, error } = await supabase
          .from("engineers")
          .insert(basePayload)
          .select()
          .single();
        if (error) throw error;
        engineerId = (data as any).id as string;
      }
      // Upsert private fields (boss/dispatcher RLS gates this; engineers cannot self-edit).
      const { error: pErr } = await supabase
        .from("engineers_private")
        .upsert({ engineer_id: engineerId, ...privatePayload } as any, {
          onConflict: "engineer_id",
        });
      if (pErr && pErr.code !== "42501") {
        // 42501 = insufficient_privilege; engineer-self editing without rights, ignore silently.
        throw pErr;
      }
      return { id: engineerId };
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["engineers"] }),
  });
}