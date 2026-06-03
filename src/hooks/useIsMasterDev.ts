import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

/**
 * Returns true when the signed-in user is the master developer.
 * Delegates to the server-side `public.is_master_dev(uid)` RPC so the
 * identifying email never ships in the client bundle.
 */
export function useIsMasterDev(): boolean {
  const { profile, status } = useAuth();
  const userId = status === "authenticated" ? profile?.id ?? null : null;

  const { data } = useQuery({
    queryKey: ["is-master-dev", userId],
    enabled: !!userId,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("is_master_dev", {
        _user_id: userId!,
      });
      if (error) throw error;
      return data === true;
    },
  });

  return data === true;
}