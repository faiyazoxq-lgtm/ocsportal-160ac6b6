import { Link, Navigate } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { useAuth } from "@/hooks/useAuth";
import { AuthStateScreen, LoadingScreen } from "./AuthStateScreen";
import type { AppRole } from "@/types/auth";

export function ProtectedRoute({
  children,
  requireRole,
}: {
  children: ReactNode;
  requireRole?: AppRole;
}) {
  const { status, profile, signOut } = useAuth();

  if (status === "loading") return <LoadingScreen label="Checking your session…" />;
  if (status === "unauthenticated") return <Navigate to="/login" replace />;

  if (status === "profile_missing") {
    return (
      <AuthStateScreen
        title="Account not provisioned"
        description="Your sign-in worked, but no operations profile is linked to this account yet. Please contact your dispatch administrator."
      >
        <button
          onClick={() => void signOut()}
          className="rounded-md border border-input bg-background px-4 py-2 text-sm font-medium hover:bg-accent"
        >
          Sign out
        </button>
      </AuthStateScreen>
    );
  }

  if (status === "inactive") {
    return (
      <AuthStateScreen
        title="Account inactive"
        description="This account has been deactivated. Please contact your dispatch administrator if this is unexpected."
      >
        <button
          onClick={() => void signOut()}
          className="rounded-md border border-input bg-background px-4 py-2 text-sm font-medium hover:bg-accent"
        >
          Sign out
        </button>
      </AuthStateScreen>
    );
  }

  if (status === "invalid_role") {
    return <Navigate to="/unauthorized" replace />;
  }

  // Boss is a superset of dispatcher operationally — Boss may access any
  // surface that requires the dispatcher role (and of course boss-only ones).
  // Engineers remain strictly limited to their own workspace.
  const roleSatisfied =
    !requireRole ||
    profile?.role === requireRole ||
    (requireRole === "dispatcher" && profile?.role === "boss");

  if (!roleSatisfied) {
    return (
      <AuthStateScreen
        title="Wrong workspace"
        description={`This area is for ${requireRole}s. You are signed in as ${profile?.role}.`}
      >
        <Link
          to={
            profile?.role === "boss"
              ? "/boss"
              : profile?.role === "dispatcher"
                ? "/admin"
                : "/engineer"
          }
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          Go to your workspace
        </Link>
      </AuthStateScreen>
    );
  }

  return <>{children}</>;
}