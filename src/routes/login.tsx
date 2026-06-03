import { createFileRoute, Navigate, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { useAuth } from "@/hooks/useAuth";
import { LoadingScreen } from "@/components/AuthStateScreen";
import { Eye, EyeOff, Lock, ShieldCheck, User } from "lucide-react";
import logoUrl from "@/assets/ocs-logo.png";

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
          ? "/boss/overview"
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
    <div
      className="relative min-h-dvh flex flex-col overflow-hidden text-white"
      style={{
        background:
          "radial-gradient(ellipse at 18% 12%, oklch(0.38 0.18 260 / 0.55), transparent 55%), radial-gradient(ellipse at 82% 88%, oklch(0.32 0.16 250 / 0.45), transparent 60%), linear-gradient(180deg, oklch(0.14 0.04 260) 0%, oklch(0.10 0.03 260) 100%)",
      }}
    >
      {/* Atmospheric layers */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.05] bg-[radial-gradient(circle_at_1px_1px,white_1px,transparent_0)] [background-size:22px_22px]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -left-40 top-1/3 h-[640px] w-[640px] rounded-full border border-white/[0.04]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -left-24 top-1/2 h-[420px] w-[420px] rounded-full border border-white/[0.05]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute right-[-10%] top-[-10%] h-[520px] w-[520px] rounded-full blur-3xl"
        style={{ background: "radial-gradient(circle, oklch(0.55 0.18 250 / 0.28), transparent 70%)" }}
      />

      {/* Top brand bar */}
      <header className="relative z-10 flex items-center justify-between px-6 pt-6 sm:px-10 sm:pt-8">
        <div className="flex items-center gap-2.5">
          <div className="flex h-7 w-9 items-center justify-center rounded-sm bg-white">
            <img src={logoUrl} alt="" className="h-4 w-auto" />
          </div>
          <span className="text-[11px] font-medium uppercase tracking-[0.22em] text-white/70">
            On Call Services
          </span>
        </div>
        <span className="hidden sm:inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[10px] font-medium uppercase tracking-[0.2em] text-white/60 backdrop-blur-sm">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_oklch(0.78_0.18_160)]" />
          Operations Console
        </span>
      </header>

      <div className="relative z-10 flex-1 grid lg:grid-cols-[1.05fr_1fr] gap-10 lg:gap-16 px-6 py-10 sm:px-10 lg:px-16 lg:py-16 items-center">
        {/* Left — bespoke brand statement */}
        <div className="hidden lg:flex flex-col max-w-xl">
          <div className="inline-flex w-fit items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-white/70 backdrop-blur-sm">
            <span className="h-1 w-1 rounded-full bg-white/80" />
            Command Environment
          </div>

          {/* Hero logo lockup */}
          <div className="mt-8 flex items-center gap-5">
            <div className="relative flex h-24 w-28 items-center justify-center rounded-lg bg-white shadow-[0_20px_60px_-20px_oklch(0.55_0.18_250_/_0.6)]">
              <img src={logoUrl} alt="OCS" className="h-16 w-auto object-contain" />
            </div>
            <div className="leading-tight">
              <div className="text-3xl font-semibold tracking-tight text-white">
                On Call Services
              </div>
              <div className="mt-1.5 text-[11px] font-medium uppercase tracking-[0.32em] text-white/55">
                Operations · Dispatch · Field
              </div>
            </div>
          </div>

          <h1 className="mt-12 text-5xl xl:text-6xl font-semibold leading-[1.02] tracking-tight">
            <span className="text-white">Precision in</span>
            <br />
            <span
              className="bg-clip-text text-transparent"
              style={{
                backgroundImage:
                  "linear-gradient(120deg, oklch(0.98 0.01 250) 0%, oklch(0.78 0.12 250) 55%, oklch(0.62 0.16 258) 100%)",
              }}
            >
              every call-out.
            </span>
          </h1>
          <p className="mt-6 max-w-md text-[15px] leading-relaxed text-white/65">
            The command surface for OCS dispatchers, engineers and leadership —
            built for speed in the field and clarity at the top.
          </p>

          <div className="mt-12 flex items-center gap-6 border-t border-white/10 pt-6 text-[11px] uppercase tracking-[0.2em] text-white/45">
            <span>24/7 Dispatch</span>
            <span className="h-3 w-px bg-white/10" />
            <span>Field-First</span>
            <span className="h-3 w-px bg-white/10" />
            <span>Audited Access</span>
          </div>
        </div>

        {/* Right — sign-in card */}
        <div className="flex w-full items-center justify-center lg:justify-end">
          <div className="w-full max-w-md">
            {/* Mobile brand mark */}
            <div className="lg:hidden mb-8 flex flex-col items-center text-center">
              <div className="flex h-20 w-24 items-center justify-center rounded-lg bg-white shadow-[0_20px_60px_-20px_oklch(0.55_0.18_250_/_0.6)]">
                <img src={logoUrl} alt="OCS" className="h-12 w-auto object-contain" />
              </div>
              <div className="mt-4 text-2xl font-semibold tracking-tight text-white">
                On Call Services
              </div>
              <div className="mt-1.5 text-[10px] font-medium uppercase tracking-[0.3em] text-white/55">
                Operations Console
              </div>
            </div>

            <div
              className="relative rounded-2xl border border-white/10 bg-white/[0.04] p-8 sm:p-10 backdrop-blur-xl"
              style={{
                boxShadow:
                  "0 30px 80px -30px oklch(0.10 0.06 260 / 0.8), inset 0 1px 0 oklch(1 0 0 / 0.08)",
              }}
            >
              <div
                aria-hidden
                className="pointer-events-none absolute inset-x-8 -top-px h-px"
                style={{
                  background:
                    "linear-gradient(90deg, transparent, oklch(0.85 0.12 250 / 0.6), transparent)",
                }}
              />

              <div className="text-center">
                <h2 className="text-[22px] font-semibold tracking-tight text-white">
                  Sign in
                </h2>
                <p className="mt-1.5 text-sm text-white/55">
                  Welcome back to your operations console
                </p>
              </div>

              <form onSubmit={onSubmit} className="mt-8 space-y-5">
                <div>
                  <label
                    className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/70"
                    htmlFor="username"
                  >
                    OCS Username
                  </label>
                  <div className="relative mt-2">
                    <User className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
                    <input
                      id="username"
                      type="text"
                      required
                      autoComplete="username"
                      placeholder="Enter your OCS username"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      className="w-full rounded-md border border-white/10 bg-white/[0.04] pl-9 pr-3 py-2.5 text-sm text-white placeholder:text-white/35 outline-none transition-colors focus:border-white/30 focus:bg-white/[0.06] focus:ring-2 focus:ring-white/10"
                    />
                  </div>
                </div>
                <div>
                  <div className="flex items-baseline justify-between">
                    <label
                      className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/70"
                      htmlFor="password"
                    >
                      Password
                    </label>
                    <a
                      href="#"
                      className="text-[11px] font-medium text-white/55 hover:text-white"
                    >
                      Forgot password?
                    </a>
                  </div>
                  <div className="relative mt-2">
                    <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
                    <input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      required
                      autoComplete="current-password"
                      placeholder="Enter your password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full rounded-md border border-white/10 bg-white/[0.04] pl-9 pr-10 py-2.5 text-sm text-white placeholder:text-white/35 outline-none transition-colors focus:border-white/30 focus:bg-white/[0.06] focus:ring-2 focus:ring-white/10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((s) => !s)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-white/45 hover:text-white"
                      aria-label={showPassword ? "Hide password" : "Show password"}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
                <label className="flex items-center gap-2 text-sm text-white/70 select-none">
                  <input
                    type="checkbox"
                    checked={remember}
                    onChange={(e) => setRemember(e.target.checked)}
                    className="h-4 w-4 rounded border-white/20 bg-white/[0.05] accent-[color:var(--royal-blue-light)]"
                  />
                  Keep me signed in on this device
                </label>
                {error ? (
                  <div className="rounded-md border border-rose-400/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">
                    {error}
                  </div>
                ) : null}
                <button
                  type="submit"
                  disabled={submitting}
                  className="group relative flex w-full items-center justify-center gap-2 rounded-md px-3 py-3 text-sm font-semibold text-white transition-all disabled:opacity-60"
                  style={{
                    background:
                      "linear-gradient(135deg, oklch(0.55 0.18 250) 0%, oklch(0.42 0.2 258) 100%)",
                    boxShadow:
                      "0 14px 36px -14px oklch(0.42 0.2 258 / 0.7), inset 0 1px 0 oklch(1 0 0 / 0.22)",
                  }}
                >
                  <Lock className="h-4 w-4" />
                  {submitting ? "Signing in…" : "Sign in to OCS"}
                </button>
              </form>
            </div>

            <p className="mt-5 text-center text-[11px] text-white/40">
              Protected by enterprise-grade security · Access logged for audit
            </p>
          </div>
        </div>
      </div>

      <footer className="relative z-10 border-t border-white/[0.06] px-6 py-5 text-center text-[11px] text-white/45 sm:px-10">
        <div className="flex flex-col items-center justify-center gap-1 sm:flex-row sm:gap-3">
          <span className="inline-flex items-center gap-1.5">
            <ShieldCheck className="h-3.5 w-3.5" />
            Restricted to authorised OCS personnel
          </span>
          <span className="hidden sm:inline text-white/20">·</span>
          <span>© {new Date().getFullYear()} On Call Services</span>
        </div>
      </footer>
    </div>
  );
}