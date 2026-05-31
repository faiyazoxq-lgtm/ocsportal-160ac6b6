import { createFileRoute, Navigate, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { useAuth } from "@/hooks/useAuth";
import { LoadingScreen } from "@/components/AuthStateScreen";
import { Logo } from "@/components/Logo";
import { Eye, EyeOff, Lock, ShieldCheck, BarChart3, Users, User } from "lucide-react";

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
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(true);

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
    const { error } = await signIn(username.trim(), password);
    if (error) setError(error);
    setSubmitting(false);
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <div className="flex-1 grid lg:grid-cols-2">
        {/* Left brand panel */}
        <div className="relative hidden lg:flex flex-col justify-between overflow-hidden bg-[oklch(0.22_0.06_255)] text-white p-12">
          <div
            aria-hidden
            className="absolute inset-0 opacity-[0.06] bg-[radial-gradient(circle_at_1px_1px,white_1px,transparent_0)] [background-size:14px_14px]"
          />
          <div
            aria-hidden
            className="absolute -right-32 top-20 h-[480px] w-[480px] rounded-full border border-white/10"
          />
          <div className="relative z-10">
            <Logo variant="light" size="xl" />
          </div>
          <div className="relative z-10 max-w-md">
            <h1 className="text-5xl font-semibold leading-tight tracking-tight">
              Operations.
              <br />
              Optimised.
            </h1>
            <p className="mt-5 text-sm leading-relaxed text-white/70">
              The central hub for managing services, teams and performance across
              On Call Services.
            </p>
            <ul className="mt-10 space-y-5">
              {[
                { icon: ShieldCheck, title: "Secure Access", desc: "Enterprise-grade security and data protection" },
                { icon: BarChart3, title: "Operational Control", desc: "Real-time visibility and performance insights" },
                { icon: Users, title: "Team Collaboration", desc: "Streamlined workflows across your organisation" },
              ].map(({ icon: Icon, title, desc }) => (
                <li key={title} className="flex items-start gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-white/5 ring-1 ring-white/10">
                    <Icon className="h-5 w-5 text-white/80" />
                  </span>
                  <div>
                    <div className="text-sm font-semibold">{title}</div>
                    <div className="text-xs text-white/60">{desc}</div>
                  </div>
                </li>
              ))}
            </ul>
          </div>
          <div className="relative z-10 h-6" />
        </div>

        {/* Right form panel */}
        <div className="flex items-center justify-center bg-muted/40 px-6 py-12">
          <div className="w-full max-w-md">
            <div className="lg:hidden mb-6 flex justify-center">
              <Logo size="lg" />
            </div>
            <div className="rounded-lg border border-border bg-card p-8 shadow-sm">
              <div className="text-center">
                <h2 className="text-2xl font-semibold text-foreground">Welcome back</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Sign in to your OCS operations account
                </p>
              </div>
              <form onSubmit={onSubmit} className="mt-7 space-y-4">
                <div>
                  <label className="text-sm font-semibold text-foreground" htmlFor="username">
                    OCS Username
                  </label>
                  <div className="relative mt-1.5">
                    <User className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <input
                      id="username"
                      type="text"
                      required
                      autoComplete="username"
                      placeholder="Enter your OCS username"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      className="w-full rounded-md border border-input bg-background pl-9 pr-3 py-2.5 text-sm text-foreground outline-none focus:border-ring focus:ring-2 focus:ring-ring/30"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-sm font-semibold text-foreground" htmlFor="password">
                    Password
                  </label>
                  <div className="relative mt-1.5">
                    <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      required
                      autoComplete="current-password"
                      placeholder="Enter your password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full rounded-md border border-input bg-background pl-9 pr-10 py-2.5 text-sm text-foreground outline-none focus:border-ring focus:ring-2 focus:ring-ring/30"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((s) => !s)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:text-foreground"
                      aria-label={showPassword ? "Hide password" : "Show password"}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  <div className="mt-1.5 flex justify-end">
                    <a href="#" className="text-xs font-medium text-primary hover:underline">
                      Forgot your password?
                    </a>
                  </div>
                </div>
                <label className="flex items-center gap-2 text-sm text-foreground select-none">
                  <input
                    type="checkbox"
                    checked={remember}
                    onChange={(e) => setRemember(e.target.checked)}
                    className="h-4 w-4 rounded border-input accent-primary"
                  />
                  Remember me
                </label>
                {error ? (
                  <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                    {error}
                  </div>
                ) : null}
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex w-full items-center justify-center gap-2 rounded-md bg-primary px-3 py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
                >
                  <Lock className="h-4 w-4" />
                  {submitting ? "Signing in…" : "Sign in"}
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>
      <footer className="border-t border-border bg-background py-5 text-center text-xs text-muted-foreground">
        <div className="flex items-center justify-center gap-2">
          <ShieldCheck className="h-3.5 w-3.5" />
          Access is restricted to authorised OCS personnel only.
        </div>
        <div className="mt-1">© {new Date().getFullYear()} On Call Services. All rights reserved.</div>
      </footer>
    </div>
  );
}