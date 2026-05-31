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
  Receipt,
  LogOut,
  Contact,
  MessageSquare,
  PhoneCall,
} from "lucide-react";
import { Activity, ShieldCheck } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { Logo } from "./Logo";
import { UserAvatar } from "@/components/account/UserAvatar";
import { NotificationBell } from "./notifications/NotificationBell";
import { NotificationPreferencesDialog } from "./notifications/NotificationPreferencesDialog";
import { CreateWorkOrderDialog } from "./admin/CreateWorkOrderDialog";
import { GlobalSearchButton } from "./search/GlobalSearchButton";
import { useState } from "react";

const NAV = [
  { label: "Dashboard", to: "/admin", icon: LayoutDashboard },
  { label: "Intake Queue", to: "/admin/intake", icon: Inbox },
  { label: "Admin Attention", to: "/admin/attention", icon: AlertTriangle },
  { label: "Dispatch Board", to: "/admin/dispatch", icon: ClipboardList },
  { label: "Diary", to: "/admin/diary", icon: CalendarDays },
  { label: "Engineers", to: "/admin/engineers", icon: Users },
  { label: "Review Queue", to: "/admin/review", icon: CheckSquare },
  { label: "Billing Prep", to: "/admin/billing", icon: Receipt },
  { label: "Follow-ups", to: "/admin/communications", icon: PhoneCall },
  { label: "Contacts", to: "/contacts", icon: Contact },
  { label: "Messages", to: "/messages", icon: MessageSquare },
  { label: "Map View", to: "/admin/map", icon: Map },
  { label: "Reports", to: "/admin/reports", icon: BarChart3 },
  { label: "Ops & QA", to: "/admin/ops", icon: Activity },
] as const;

const BOSS_NAV = [
  { label: "Command", to: "/boss/overview", icon: LayoutDashboard },
  { label: "People & Roles", to: "/boss/members", icon: Users },
  { label: "Inbox", to: "/boss/inbox", icon: Inbox },
  { label: "Ops & Audit", to: "/boss/ops", icon: Activity },
  { label: "Infrastructure", to: "/boss/infrastructure", icon: ShieldCheck },
] as const;

const ENABLED_ROUTES = new Set<string>([
  "/admin",
  "/admin/intake",
  "/admin/attention",
  "/admin/dispatch",
  "/admin/diary",
  "/admin/engineers",
  "/admin/review",
  "/admin/billing",
  "/admin/communications",
  "/contacts",
  "/messages",
  "/admin/map",
  "/admin/reports",
  "/admin/ops",
]);

export function DispatcherShell({ children }: { children: ReactNode }) {
  const { profile, signOut } = useAuth();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [prefsOpen, setPrefsOpen] = useState(false);
  const isBoss = profile?.role === "boss";

  return (
    <div className="flex min-h-screen w-full flex-col bg-background pt-10">
      <div className="fixed inset-x-0 top-0 z-50 flex h-10 items-center gap-2 border-b border-sky-500/30 bg-sky-600 px-5 text-[13px] font-bold uppercase tracking-wider text-white shadow-sm">
        <ClipboardList className="h-4 w-4" />
        Dispatcher Console
      </div>
      <div className="flex flex-1">
        <aside className="hidden w-64 shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground md:flex">
        <div className="border-b border-sidebar-border px-4 py-5">
          <Logo variant="light" />
        </div>
        <nav className="flex-1 overflow-y-auto px-2 py-4">
          {isBoss ? (
            <>
              <div className="mb-1.5 px-2 text-[11px] font-semibold uppercase tracking-wider text-sidebar-foreground/50">Boss</div>
              {BOSS_NAV.map((item) => {
                const Icon = item.icon;
                const active = pathname === item.to || pathname.startsWith(item.to + "/");
                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    className={`mb-0.5 flex items-center gap-2.5 rounded-sm px-3 py-2.5 text-[15px] ${
                      active
                        ? "bg-sidebar-accent text-sidebar-accent-foreground"
                        : "text-sidebar-foreground/80 hover:bg-sidebar-accent/40"
                    }`}
                  >
                    <Icon className="h-[18px] w-[18px]" />
                    {item.label}
                  </Link>
                );
              })}
              <div className="mb-1.5 mt-5 px-2 text-[11px] font-semibold uppercase tracking-wider text-sidebar-foreground/50">Operations</div>
            </>
          ) : null}
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
                  className={`mb-0.5 flex w-full items-center gap-3 rounded-sm px-3 py-2.5 text-left text-[15px] transition-colors ${
                    active
                      ? "bg-sidebar-accent text-sidebar-accent-foreground"
                      : "text-sidebar-foreground/80 hover:bg-sidebar-accent/40"
                  }`}
                >
                  <Icon className="h-[18px] w-[18px]" />
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
                className={`mb-0.5 flex w-full items-center gap-3 rounded-sm px-3 py-2.5 text-left text-[15px] transition-colors ${
                  active
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-sidebar-foreground/80 hover:bg-sidebar-accent/40"
                } disabled:cursor-not-allowed`}
              >
                <Icon className="h-[18px] w-[18px]" />
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
        <header className="flex h-16 items-center justify-between border-b border-border bg-card px-5 md:px-7">
          <div className="flex items-center gap-3">
            <div className="inline-flex items-center rounded-sm bg-sky-500/10 px-2.5 py-1.5 text-xs font-bold uppercase tracking-wider text-sky-700 ring-1 ring-inset ring-sky-400/30">
              <ClipboardList className="mr-1.5 h-4 w-4" />
              Dispatcher
            </div>
            <span className="flex items-center gap-2 text-[15px] font-medium text-foreground">
              <UserAvatar url={profile?.avatar_url} name={profile?.full_name || profile?.email} size={28} />
              {profile?.full_name || profile?.email}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <GlobalSearchButton />
            <CreateWorkOrderDialog triggerLabel="New work order" />
            <NotificationBell onOpenPreferences={() => setPrefsOpen(true)} />
            <Link
              to="/account"
              className="inline-flex items-center gap-2 rounded-sm border border-border bg-background px-3 py-2 text-sm font-medium text-foreground hover:bg-accent"
            >
              Account
            </Link>
            <button
              onClick={() => void signOut()}
              className="inline-flex items-center gap-2 rounded-sm border border-border bg-background px-3 py-2 text-sm font-medium text-foreground hover:bg-accent"
            >
              <LogOut className="h-4 w-4" />
              Sign out
            </button>
          </div>
        </header>
        <main className="flex-1 overflow-y-auto p-5 md:p-7">{children}</main>
      </div>
      </div>
      <NotificationPreferencesDialog
        open={prefsOpen}
        onOpenChange={setPrefsOpen}
        role="dispatcher"
      />
    </div>
  );
}