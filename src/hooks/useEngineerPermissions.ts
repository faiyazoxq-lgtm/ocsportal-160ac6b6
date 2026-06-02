import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  mergeEngineerPermissions,
  type EngineerPermissions,
  type EngineerPermissionCategoryId,
} from "@/lib/engineerPermissions";
import { useAuth } from "@/hooks/useAuth";

/** Loads the boss-controlled engineer permissions (merged with safe defaults). */
export function useEngineerPermissions() {
  return useQuery<EngineerPermissions>({
    queryKey: ["engineer_permissions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("company_settings")
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .select("engineer_permissions" as any)
        .eq("singleton", true)
        .maybeSingle();
      if (error) throw error;
      const rec = (data ?? null) as { engineer_permissions: unknown } | null;
      return mergeEngineerPermissions(
        (rec?.engineer_permissions ?? null) as Partial<EngineerPermissions> | null,
      );
    },
    staleTime: 60_000,
  });
}

/**
 * Returns true if the current viewer can see the given permission flag.
 * Non-engineers (boss, dispatcher) always pass — gating only applies to engineers.
 */
export function useEngineerCanSee(
  category: EngineerPermissionCategoryId,
  key: string,
): boolean {
  const { profile } = useAuth();
  const { data } = useEngineerPermissions();
  if (profile?.role !== "engineer") return true;
  if (!data) return false;
  return Boolean(data[category]?.[key]);
}