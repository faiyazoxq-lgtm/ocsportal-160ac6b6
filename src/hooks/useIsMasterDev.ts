import { useAuth } from "@/hooks/useAuth";

/** Hardcoded developer/master account email. */
export const MASTER_DEV_EMAIL = "ogstreamz196@gmail.com";

/**
 * Returns true when the signed-in user is the hardcoded master developer.
 * Mirrors the SQL helper `public.is_master_dev(uid)`.
 */
export function useIsMasterDev(): boolean {
  const { profile, status } = useAuth();
  if (status !== "authenticated" || !profile?.email) return false;
  return profile.email.toLowerCase() === MASTER_DEV_EMAIL;
}