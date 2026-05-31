import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { AuthStateScreen, LoadingScreen } from "@/components/AuthStateScreen";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/boss/claim")({
  component: ClaimBossPage,
});

function ClaimBossPage() {
  const { status, profile } = useAuth();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<"claimed" | "already" | null>(null);

  if (status === "loading") return <LoadingScreen label="Checking your session…" />;
  if (status === "unauthenticated") {
    return (
      <AuthStateScreen
        title="Sign in required"
        description="Sign in first, then return to /boss/claim to seed the first Boss account."
      />
    );
  }

  const handleClaim = async () => {
    setBusy(true);
    setError(null);
    try {
      const { data, error: rpcError } = await supabase.rpc("claim_first_boss");
      if (rpcError) throw rpcError;
      if (data === true) {
        setResult("claimed");
        // Refresh session role and route into boss area
        setTimeout(() => navigate({ to: "/boss/overview", replace: true }), 1200);
      } else {
        setResult("already");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to claim Boss role");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-md p-6 space-y-4">
      <h1 className="text-xl font-semibold">Claim Boss / Super Admin</h1>
      <p className="text-sm text-muted-foreground">
        Signed in as <span className="font-mono">{profile?.email ?? "unknown"}</span>.
        This action promotes the current account to <strong>Boss</strong> only if no
        Boss exists yet. It is a one-time seed and is safe to leave in place — once any
        Boss is present, this page will refuse further claims.
      </p>
      {result === "claimed" && (
        <p className="text-sm text-green-600">
          Boss role granted. Redirecting to the Boss overview…
        </p>
      )}
      {result === "already" && (
        <p className="text-sm text-amber-600">
          A Boss already exists. Ask the existing Boss to grant you access from
          /boss/members.
        </p>
      )}
      {error && <p className="text-sm text-destructive">{error}</p>}
      <Button onClick={handleClaim} disabled={busy || result === "claimed"}>
        {busy ? "Claiming…" : "Claim Boss role"}
      </Button>
    </div>
  );
}