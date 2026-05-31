import { createFileRoute, Navigate, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { useAuth } from "@/hooks/useAuth";
import { LoadingScreen } from "@/components/AuthStateScreen";
import { Logo } from "@/components/Logo";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Sign in · OCS Operations" },
      { name: "description", content: "Sign in to the OCS operations console." },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  const { status, profile, signIn } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (status === "authenticated" && profile) {
      const dest =
        profile.role === "boss"
          ? "/boss"
          : profile.role === "dispatcher"
            ? "/admin"
            : "/engineer";
      void navigate({ to: dest, replace: true });
    }
  }, [status, profile, navigate]);

  if (status === "loading") return <LoadingScreen />;
  if (status === "invalid_role") return <Navigate to="/unauthorized" replace />;

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    const { error } = await signIn(email.trim(), password);
    if (error) setError(error);
    setSubmitting(false);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex justify-center">
          <Logo />
        </div>
        <div className="rounded-md border border-border bg-card p-6 shadow-sm">
          <h1 className="text-base font-semibold text-foreground">Sign in</h1>
          <p className="mt-1 text-xs text-muted-foreground">
            Use your OCS operations account to continue.
          </p>
          <form onSubmit={onSubmit} className="mt-5 space-y-3">
            <div>
              <label className="text-xs font-medium text-foreground" htmlFor="email">
                Email
              </label>
              <input
                id="email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1 w-full rounded-sm border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-ring focus:ring-1 focus:ring-ring"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-foreground" htmlFor="password">
                Password
              </label>
              <input
                id="password"
                type="password"
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1 w-full rounded-sm border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-ring focus:ring-1 focus:ring-ring"
              />
            </div>
            {error ? (
              <div className="rounded-sm border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                {error}
              </div>
            ) : null}
            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-sm bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
            >
              {submitting ? "Signing in…" : "Sign in"}
            </button>
          </form>
        </div>
        <p className="mt-4 text-center text-[11px] text-muted-foreground">
          Access is restricted to authorised OCS personnel.
        </p>
      </div>
    </div>
  );
}