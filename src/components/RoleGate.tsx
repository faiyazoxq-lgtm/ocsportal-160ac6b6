import type { ReactNode } from "react";
import { useAuth } from "@/hooks/useAuth";
import type { AppRole } from "@/types/auth";

export function RoleGate({
  allow,
  children,
  fallback = null,
}: {
  allow: AppRole | AppRole[];
  children: ReactNode;
  fallback?: ReactNode;
}) {
  const { profile, status } = useAuth();
  if (status !== "authenticated" || !profile) return <>{fallback}</>;
  const allowed = Array.isArray(allow) ? allow : [allow];
  return allowed.includes(profile.role) ? <>{children}</> : <>{fallback}</>;
}