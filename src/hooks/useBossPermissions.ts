import { useAuth } from "@/hooks/useAuth";

export function useBossPermissions() {
  const { profile, status } = useAuth();
  const isBoss = status === "authenticated" && profile?.role === "boss";
  return {
    isBoss,
    profile,
    canManageStaff: isBoss,
    canOverrideJobs: isBoss,
    canViewAudit: isBoss,
  };
}