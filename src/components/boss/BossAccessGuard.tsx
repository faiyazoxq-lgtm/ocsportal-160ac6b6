import type { ReactNode } from "react";
import { Navigate } from "@tanstack/react-router";
import { useAuth } from "@/hooks/useAuth";
import { AuthStateScreen, LoadingScreen } from "@/components/AuthStateScreen";

export function BossAccessGuard({ children }: { children: ReactNode }) {
  const { status, profile } = useAuth();
  if (status === "loading") return <LoadingScreen label="Checking your session…" />;
  if (status === "unauthenticated") return <Navigate to="/login" replace />;
  if (status !== "authenticated" || profile?.role !== "boss") {
    return (
      <AuthStateScreen
        title="Boss access required"
        description="This area is restricted to Boss / Super Admin accounts."
      />
    );
  }
  return <>{children}</>;
}