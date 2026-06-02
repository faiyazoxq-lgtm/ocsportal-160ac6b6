import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type FieldEditInfo = { at: string; actor: string | null };
export type FieldEditMap = Record<string, FieldEditInfo>;

/**
 * Returns the latest edit timestamp + actor name per field for a work order,
 * derived from work_order_events rows with event_type in (dispatcher_edit,
 * engineer_edit) and a `fields` array in event_payload_json.
 */
export function useWorkOrderFieldEdits(workOrderId: string | null) {
  return useQuery({
    queryKey: ["work_orders", "field_edits", workOrderId],
    enabled: !!workOrderId,
    queryFn: async (): Promise<FieldEditMap> => {
      if (!workOrderId) return {};
      const { data, error } = await supabase
        .from("work_order_events")
        .select("event_type, event_payload_json, created_at, actor_profile_id, actor_engineer_id")
        .eq("work_order_id", workOrderId)
        .in("event_type", ["dispatcher_edit", "engineer_edit"])
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;

      const rows = data ?? [];
      const profileIds = Array.from(
        new Set(rows.map((r) => r.actor_profile_id).filter(Boolean) as string[]),
      );
      const engineerIds = Array.from(
        new Set(rows.map((r) => r.actor_engineer_id).filter(Boolean) as string[]),
      );

      const [profilesRes, engineersRes] = await Promise.all([
        profileIds.length
          ? supabase.from("profiles").select("id, full_name, email").in("id", profileIds)
          : Promise.resolve({ data: [], error: null } as never),
        engineerIds.length
          ? supabase.from("engineers").select("id, display_name").in("id", engineerIds)
          : Promise.resolve({ data: [], error: null } as never),
      ]);
      const profileMap = new Map<string, string>(
        ((profilesRes.data ?? []) as Array<{ id: string; full_name: string | null; email: string | null }>)
          .map((p) => [p.id, p.full_name || p.email || "User"]),
      );
      const engineerMap = new Map<string, string>(
        ((engineersRes.data ?? []) as Array<{ id: string; display_name: string | null }>)
          .map((e) => [e.id, e.display_name || "Engineer"]),
      );

      const out: FieldEditMap = {};
      // rows already sorted newest first; only set per field if absent.
      for (const r of rows) {
        const payload = (r.event_payload_json ?? {}) as { fields?: string[] };
        const fields = Array.isArray(payload.fields) ? payload.fields : [];
        if (fields.length === 0) continue;
        const actor =
          (r.actor_profile_id && profileMap.get(r.actor_profile_id)) ||
          (r.actor_engineer_id && engineerMap.get(r.actor_engineer_id)) ||
          null;
        for (const f of fields) {
          if (!out[f]) out[f] = { at: r.created_at, actor };
        }
      }
      return out;
    },
  });
}