import { Link, useRouterState } from "@tanstack/react-router";
import type { ReactNode } from "react";
import {
  LayoutDashboard,
  Inbox,
  AlertTriangle,
  ClipboardList,
  CalendarDays,
  Users,
  CheckSquare,
  Map,
  BarChart3,
  LogOut,
  Contact,
  MessageSquare,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { Logo } from "./Logo";
import { DemoDataBanner } from "./admin/DemoDataBanner";

const NAV = [
  { label: "Dashboard", to: "/admin", icon: LayoutDashboard },
  { label: "Intake Queue", to: "/admin/intake", icon: Inbox },
  { label: "Admin Attention", to: "/admin/attention", icon: AlertTriangle },
  { label: "Dispatch Board", to: "/admin/dispatch", icon: ClipboardList },
  { label: "Diary", to: "/admin/diary", icon: CalendarDays },
  { label: "Engineers", to: "/admin/engineers", icon: Users },
  { label: "Review Queue", to: "/admin/review", icon: CheckSquare },
  { label: "Contacts", to: "/contacts", icon: Contact },
  { label: "Messages", to: "/messages", icon: MessageSquare },
  { label: "Map View", to: "/admin/map", icon: Map },
  { label: "Reports", to: "/admin/reports", icon: BarChart3 },
] as const;

const ENABLED_ROUTES = new Set<string>([
  "/admin",
  "/admin/intake",
  "/admin/attention",
  "/admin/dispatch",
  "/admin/engineers",
  "/admin/review",
  "/contacts",
  "/messages",
]);

export function DispatcherShell({ children }: { children: ReactNode }) {
  const { profile, signOut } = useAuth();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <div className="flex min-h-screen w-full bg-background">
      <aside className="hidden w-60 shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground md:flex">
        <div className="border-b border-sidebar-border px-4 py-4">
          <Logo variant="light" />
        </div>
        <nav className="flex-1 overflow-y-auto px-2 py-3">
          {NAV.map((item) => {
            const active = pathname === item.to;
            const Icon = item.icon;
            const enabled = ENABLED_ROUTES.has(item.to);
            if (enabled) {
              return (
                <Link
                  key={item.label}
                  to={item.to}
                  aria-current={active ? "page" : undefined}
                  className={`mb-0.5 flex w-full items-center gap-2.5 rounded-sm px-3 py-2 text-left text-sm transition-colors ${
                    active
                      ? "bg-sidebar-accent text-sidebar-accent-foreground"
                      : "text-sidebar-foreground/80 hover:bg-sidebar-accent/40"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  <span>{item.label}</span>
                </Link>
              );
            }
            return (
              <button
                key={item.label}
                type="button"
                disabled
                aria-current={active ? "page" : undefined}
                className={`mb-0.5 flex w-full items-center gap-2.5 rounded-sm px-3 py-2 text-left text-sm transition-colors ${
                  active
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-sidebar-foreground/80 hover:bg-sidebar-accent/40"
                } disabled:cursor-not-allowed`}
              >
                <Icon className="h-4 w-4" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>
        <div className="border-t border-sidebar-border px-4 py-3 text-xs text-sidebar-foreground/60">
          v0.1 · Foundation
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 items-center justify-between border-b border-border bg-card px-4 md:px-6">
          <div className="flex flex-col">
            <span className="text-[11px] uppercase tracking-wider text-muted-foreground">
              Dispatcher
            </span>
            <span className="text-sm font-medium text-foreground">
              {profile?.full_name || profile?.email}
            </span>
          </div>
          <button
            onClick={() => void signOut()}
            className="inline-flex items-center gap-2 rounded-sm border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground hover:bg-accent"
          >
            <LogOut className="h-3.5 w-3.5" />
            Sign out
          </button>
        </header>
        <DemoDataBanner />
        <main className="flex-1 overflow-y-auto p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}