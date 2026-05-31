import { Link, useRouterState } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { LayoutDashboard, Users, ShieldCheck, Activity, LogOut, KeyRound } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { Logo } from "@/components/Logo";

const NAV = [
  { label: "Overview", to: "/boss/overview", icon: LayoutDashboard },
  { label: "People", to: "/boss/members", icon: Users },
  { label: "Ops & Audit", to: "/boss/ops", icon: Activity },
  { label: "Infrastructure", to: "/boss/infrastructure", icon: ShieldCheck },
] as const;

export function BossShell({ children }: { children: ReactNode }) {
  const { profile, signOut } = useAuth();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  return (
    <div className="flex min-h-screen w-full flex-col bg-background pt-9">
      <div className="fixed inset-x-0 top-0 z-50 flex h-9 items-center gap-2 border-b border-indigo-500/30 bg-indigo-600 px-4 text-xs font-bold uppercase tracking-wider text-white shadow-sm">
        <ShieldCheck className="h-4 w-4" />
        Boss Console
      </div>
      <div className="flex flex-1">
        <aside className="hidden w-60 shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground md:flex">
        <div className="border-b border-sidebar-border px-4 py-4">
          <Logo variant="light" />
          <div className="mt-3 inline-flex items-center rounded-sm bg-indigo-500/20 px-2.5 py-1.5 text-[11px] font-bold uppercase tracking-wider text-indigo-200 ring-1 ring-inset ring-indigo-400/30">
            <ShieldCheck className="mr-1.5 h-3.5 w-3.5" />
            Boss Console
          </div>
        </div>
        <nav className="flex-1 overflow-y-auto px-2 py-3">
          {NAV.map((item) => {
            const Icon = item.icon;
            const active = pathname === item.to || pathname.startsWith(item.to + "/");
            return (
              <Link
                key={item.to}
                to={item.to}
                className={`mb-0.5 flex items-center gap-2 rounded-sm px-3 py-2 text-xs ${
                  active
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-sidebar-foreground/80 hover:bg-sidebar-accent/40"
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-sidebar-border p-3 text-[11px] text-sidebar-foreground/70">
          <div className="mb-2 truncate">{profile?.email}</div>
          <Link
            to="/account"
            className="mb-1 flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-xs hover:bg-sidebar-accent/40"
          >
            <KeyRound className="h-3.5 w-3.5" /> Account & password
          </Link>
          <button
            onClick={() => void signOut()}
            className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-xs hover:bg-sidebar-accent/40"
          >
            <LogOut className="h-3.5 w-3.5" /> Sign out
          </button>
        </div>
      </aside>
      <main className="flex-1 overflow-x-hidden">
        <div className="mx-auto max-w-7xl px-4 py-5">{children}</div>
      </main>
      </div>
    </div>
  );
}