import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { PersonRow } from "@/types/people";

export function usePeopleDirectory() {
  return useQuery({
    queryKey: ["people", "directory"],
    queryFn: async (): Promise<PersonRow[]> => {
      const [{ data: profiles, error: pErr }, { data: exts, error: eErr }, { data: engs, error: enErr }] =
        await Promise.all([
          supabase
            .from("profiles")
            .select("id,email,full_name,phone,role,is_active,created_at"),
          supabase
            .from("external_contacts")
            .select("id,name,email,phone,organization,role_label,contact_type,notes,archived_at,created_at"),
          supabase
            .from("engineers")
            .select("id,profile_id,primary_trade,trade_tags,covered_postcode_zones,certification_tags,can_lead,complexity_cap,active_status"),
        ]);
      if (pErr) throw pErr;
      if (eErr) throw eErr;
      if (enErr) throw enErr;

      const engMap = new Map(
        (engs ?? []).filter((e) => e.profile_id).map((e) => [e.profile_id as string, e]),
      );

      const userRows: PersonRow[] = (profiles ?? []).map((p) => {
        const e = engMap.get(p.id);
        return {
          key: `u:${p.id}`,
          kind: "app_user",
          id: p.id,
          profile_id: p.id,
          external_contact_id: null,
          display_name: p.full_name || p.email,
          email: p.email,
          phone: p.phone,
          role: p.role as PersonRow["role"],
          is_active: p.is_active,
          external_type: null,
          organization: null,
          role_label: null,
          notes: null,
          archived_at: null,
          engineer: e
            ? {
                id: e.id,
                primary_trade: e.primary_trade,
                trade_tags: e.trade_tags ?? [],
                covered_postcode_zones: e.covered_postcode_zones ?? [],
                certification_tags: e.certification_tags ?? [],
                can_lead: e.can_lead ?? true,
                complexity_cap: e.complexity_cap as "basic" | "intermediate" | "advanced",
                active_status: e.active_status ?? true,
              }
            : null,
          created_at: p.created_at,
        };
      });

      const extRows: PersonRow[] = (exts ?? []).map((c) => ({
        key: `c:${c.id}`,
        kind: "external_contact",
        id: c.id,
        profile_id: null,
        external_contact_id: c.id,
        display_name: c.name,
        email: c.email,
        phone: c.phone,
        role: null,
        is_active: null,
        external_type: c.contact_type,
        organization: c.organization,
        role_label: c.role_label,
        notes: c.notes,
        archived_at: c.archived_at,
        engineer: null,
        created_at: c.created_at,
      }));

      return [...userRows, ...extRows].sort((a, b) =>
        a.display_name.localeCompare(b.display_name),
      );
    },
  });
}

export interface ExternalContactInput {
  id?: string;
  name: string;
  organization?: string | null;
  role_label?: string | null;
  phone?: string | null;
  email?: string | null;
  contact_type?: string;
  notes?: string | null;
}

export function useExternalContactMutations() {
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: ["people", "directory"] });

  const upsert = useMutation({
    mutationFn: async (input: ExternalContactInput) => {
      if (input.id) {
        const { error } = await supabase
          .from("external_contacts")
          .update({
            name: input.name,
            organization: input.organization ?? null,
            role_label: input.role_label ?? null,
            phone: input.phone ?? null,
            email: input.email ?? null,
            contact_type: (input.contact_type ?? "other") as never,
            notes: input.notes ?? null,
          })
          .eq("id", input.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("external_contacts").insert({
          name: input.name,
          organization: input.organization ?? null,
          role_label: input.role_label ?? null,
          phone: input.phone ?? null,
          email: input.email ?? null,
          contact_type: (input.contact_type ?? "other") as never,
          notes: input.notes ?? null,
        } as never);
        if (error) throw error;
      }
    },
    onSuccess: invalidate,
  });

  const setArchived = useMutation({
    mutationFn: async (args: { id: string; archived: boolean }) => {
      const { data: u } = await supabase.auth.getUser();
      const { error } = await supabase
        .from("external_contacts")
        .update({
          archived_at: args.archived ? new Date().toISOString() : null,
          archived_by: args.archived ? u.user?.id ?? null : null,
        } as never)
        .eq("id", args.id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  return { upsert, setArchived };
}