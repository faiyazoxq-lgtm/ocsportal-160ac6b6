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
              "id, profile_id, display_name, primary_trade, trade_tags, certification_tags, covered_postcode_zones, active_status",
            ),
        ]);
      if (pErr) throw pErr;
      if (cpErr) throw cpErr;
      if (eErr) throw eErr;

      const cpMap = new Map((cps ?? []).map((c) => [c.profile_id, c]));
      const engMap = new Map(
        (engs ?? []).filter((e) => e.profile_id).map((e) => [e.profile_id as string, e]),
      );

      const userEntries = (profiles ?? []).map((p) => {
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

      // Surface engineers without a linked auth user — not messageable but visible.
      const engineerOnlyEntries: ContactDirectoryEntry[] = (engs ?? [])
        .filter((e) => !e.profile_id)
        .map((e) => ({
          profile_id: e.id,
          engineer_only: true,
          engineer_id: e.id,
          full_name: e.display_name,
          email: null,
          phone: null,
          role: "engineer",
          is_active: e.active_status ?? true,
          avatar_url: null,
          job_title: null,
          capability_summary: null,
          telegram_linked: false,
          telegram_username: null,
          engineer: {
            id: e.id,
            primary_trade: e.primary_trade,
            trade_tags: e.trade_tags ?? [],
            certification_tags: e.certification_tags ?? [],
            covered_postcode_zones: e.covered_postcode_zones ?? [],
          },
        }));

      return [...userEntries, ...engineerOnlyEntries].sort((a, b) =>
        (a.full_name ?? a.email ?? "").localeCompare(b.full_name ?? b.email ?? ""),
      );
    },
  });
}

export function useContactDetail(profileId: string | null) {
  const list = useContacts();
  const entry = list.data?.find((c) => c.profile_id === profileId) ?? null;
  return { ...list, data: entry };
}