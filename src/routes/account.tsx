import { useState } from "react";
import { createFileRoute, Link, Navigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { AuthStateScreen, LoadingScreen } from "@/components/AuthStateScreen";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/account")({
  head: () => ({ meta: [{ title: "Account · Security" }] }),
  component: AccountPage,
});

function AccountPage() {
  const { status, profile } = useAuth();
  const [pw1, setPw1] = useState("");
  const [pw2, setPw2] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  if (status === "loading") return <LoadingScreen label="Checking your session…" />;
  if (status === "unauthenticated") return <Navigate to="/login" replace />;
  if (status !== "authenticated") {
    return <AuthStateScreen title="Session unavailable" description="Please sign in again." />;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg(null);
    if (pw1.length < 8) return setMsg({ kind: "err", text: "Password must be at least 8 characters." });
    if (pw1 !== pw2) return setMsg({ kind: "err", text: "Passwords do not match." });
    setBusy(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: pw1 });
      if (error) throw error;
      setPw1(""); setPw2("");
      setMsg({ kind: "ok", text: "Password updated. Use it next time you sign in." });
    } catch (err) {
      setMsg({ kind: "err", text: err instanceof Error ? err.message : "Failed to update password" });
    } finally {
      setBusy(false);
    }
  };

  const homeFor = profile?.role === "boss" ? "/boss/overview"
    : profile?.role === "dispatcher" ? "/admin"
    : "/engineer";

  return (
    <div className="mx-auto max-w-md p-6 space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-base font-semibold">Account · Security</h1>
        <Link to={homeFor} className="text-xs text-muted-foreground hover:underline">Back</Link>
      </div>
      <div className="rounded-md border border-border bg-card p-4 text-xs space-y-1">
        <div><span className="text-muted-foreground">Signed in as </span><span className="font-mono">{profile?.email}</span></div>
        <div><span className="text-muted-foreground">Role </span><span className="uppercase">{profile?.role}</span></div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3 rounded-md border border-border bg-card p-4">
        <h2 className="text-sm font-semibold">Change password</h2>
        <p className="text-xs text-muted-foreground">
          Minimum 8 characters. If a Boss set you a temporary password, change it here.
        </p>
        <label className="block text-xs">
          <div className="mb-1 font-medium">New password</div>
          <input type="password" value={pw1} onChange={(e) => setPw1(e.target.value)}
            className="w-full rounded-sm border border-input bg-background px-2 py-1.5" autoComplete="new-password" />
        </label>
        <label className="block text-xs">
          <div className="mb-1 font-medium">Confirm new password</div>
          <input type="password" value={pw2} onChange={(e) => setPw2(e.target.value)}
            className="w-full rounded-sm border border-input bg-background px-2 py-1.5" autoComplete="new-password" />
        </label>
        {msg && (
          <p className={msg.kind === "ok" ? "text-xs text-emerald-600" : "text-xs text-destructive"}>{msg.text}</p>
        )}
        <Button type="submit" disabled={busy}>{busy ? "Updating…" : "Update password"}</Button>
      </form>
    </div>
  );
}