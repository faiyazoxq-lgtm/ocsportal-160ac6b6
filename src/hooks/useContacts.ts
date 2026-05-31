import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { ContactDirectoryEntry } from "@/types/contacts";

export function useContacts() {
  return useQuery({
    queryKey: ["contacts", "directory"],
    queryFn: async (): Promise<ContactDirectoryEntry[]> => {
      const [{ data: profiles, error: pErr }, { data: cps, error: cpErr }, { data: engs, error: eErr }] =
        await Promise.all([
          supabase
            .from("profiles")
            .select("id, full_name, email, phone, role, is_active")
            .eq("is_active", true),
          supabase
            .from("user_contact_profiles")
            .select(
              "profile_id, avatar_url, job_title, capability_summary, telegram_username, telegram_linked_at",
            ),
          supabase
            .from("engineers")
            .select(
              "id, profile_id, primary_trade, trade_tags, certification_tags, covered_postcode_zones",
            ),
        ]);
      if (pErr) throw pErr;
      if (cpErr) throw cpErr;
      if (eErr) throw eErr;

      const cpMap = new Map((cps ?? []).map((c) => [c.profile_id, c]));
      const engMap = new Map(
        (engs ?? []).filter((e) => e.profile_id).map((e) => [e.profile_id as string, e]),
      );

      return (profiles ?? []).map((p) => {
        const cp = cpMap.get(p.id);
        const e = engMap.get(p.id);
        return {
          profile_id: p.id,
          full_name: p.full_name,
          email: p.email,
          phone: p.phone,
          role: p.role,
          is_active: p.is_active,
          avatar_url: cp?.avatar_url ?? null,
          job_title: cp?.job_title ?? null,
          capability_summary: cp?.capability_summary ?? null,
          telegram_linked: !!cp?.telegram_linked_at,
          telegram_username: cp?.telegram_username ?? null,
          engineer: e
            ? {
                id: e.id,
                primary_trade: e.primary_trade,
                trade_tags: e.trade_tags ?? [],
                certification_tags: e.certification_tags ?? [],
                covered_postcode_zones: e.covered_postcode_zones ?? [],
              }
            : null,
        } satisfies ContactDirectoryEntry;
      });
    },
  });
}

export function useContactDetail(profileId: string | null) {
  const list = useContacts();
  const entry = list.data?.find((c) => c.profile_id === profileId) ?? null;
  return { ...list, data: entry };
}