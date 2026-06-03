import { Link, useRouterState } from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";
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
  Menu,
  X,
  Activity,
} from "lucide-react";
import { CheckCircle2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { Logo } from "./Logo";
import { BossShell } from "@/components/boss/BossShell";
import { UserAvatar } from "@/components/account/UserAvatar";
import { NotificationBell } from "./notifications/NotificationBell";
import { EngineerUnavailableToaster } from "./notifications/EngineerUnavailableToaster";
import { NotificationPreferencesDialog } from "./notifications/NotificationPreferencesDialog";
import { CreateWorkOrderDialog } from "./admin/CreateWorkOrderDialog";
import { GlobalSearchButton } from "./search/GlobalSearchButton";
import { useState } from "react";
import { useNavBadgeCounts } from "@/hooks/useNavBadgeCounts";
import { NavBadge } from "./nav/NavBadge";
import { useAutoInboxSync } from "@/hooks/useAutoInboxSync";

const NAV = [
  { label: "Dashboard", to: "/admin", icon: LayoutDashboard },
  { label: "Email Intake Queue", to: "/admin/intake", icon: Inbox },
  { label: "Admin Attention", to: "/admin/attention", icon: AlertTriangle },
  { label: "ALL WORK ORDERS", to: "/admin/dispatch", icon: ClipboardList },
  { label: "Diary", to: "/admin/diary", icon: CalendarDays },
  { label: "Engineers", to: "/admin/engineers", icon: Users },
  { label: "Review Queue", to: "/admin/review", icon: CheckSquare },
  { label: "Closed Jobs", to: "/admin/closed-jobs", icon: CheckCircle2 },
  { label: "Billing Prep", to: "/admin/billing", icon: Receipt },
  { label: "Expenses", to: "/admin/expenses", icon: Receipt },
  { label: "Follow-ups", to: "/admin/communications", icon: PhoneCall },
  { label: "Contacts", to: "/contacts", icon: Contact },
  { label: "Messages", to: "/messages", icon: MessageSquare },
  { label: "Map View", to: "/admin/map", icon: Map },
  { label: "Reports", to: "/admin/reports", icon: BarChart3 },
  { label: "Ops & QA", to: "/admin/ops", icon: Activity },
] as const;

const ENABLED_ROUTES = new Set<string>([
  "/admin",
  "/admin/intake",
  "/admin/attention",
  "/admin/dispatch",
  "/admin/diary",
  "/admin/engineers",
  "/admin/review",
  "/admin/closed-jobs",
  "/admin/billing",
  "/admin/expenses",
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
  const [navOpen, setNavOpen] = useState(false);
  useEffect(() => { setNavOpen(false); }, [pathname]);
  const isBoss = profile?.role === "boss";
  const badgeCounts = useNavBadgeCounts();
  useAutoInboxSync();

  if (isBoss) {
    return <BossShell>{children}</BossShell>;
  }

  const SignOutFooter = (
    <div className="border-t border-sidebar-border p-3 text-sm text-sidebar-foreground/70">
      <button
        onClick={() => void signOut()}
        className="flex w-full items-center gap-2.5 rounded-sm px-3 py-2.5 text-[15px] hover:bg-sidebar-accent/40"
      >
        <LogOut className="h-[18px] w-[18px]" /> Sign out
      </button>
    </div>
  );

  const NewWorkOrderButton = (
    <div className="px-3 py-2">
      <CreateWorkOrderDialog triggerLabel="New work order" triggerSize="default" triggerVariant="default" />
    </div>
  );

  const NavList = (
    <nav className="flex-1 overflow-y-auto px-2 py-4">
      {NAV.map((item) => {
        const active = pathname === item.to;
        const Icon = item.icon;
        const enabled = ENABLED_ROUTES.has(item.to);
        const badge = badgeCounts[item.to] ?? 0;
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
              <span className="flex-1">{item.label}</span>
              <NavBadge count={badge} />
            </Link>
          );
        }
        return (
          <button
            key={item.label}
            type="button"
            disabled
            aria-current={active ? "page" : undefined}
            className={`mb-0.5 flex w-full items-center gap-3 rounded-sm px-3 py-2.5 text-left text-[15px] text-sidebar-foreground/40 disabled:cursor-not-allowed`}
          >
            <Icon className="h-[18px] w-[18px]" />
            <span className="flex-1">{item.label}</span>
            <NavBadge count={badge} muted />
          </button>
        );
      })}
    </nav>
  );

  return (
    <div className="flex h-dvh w-full flex-col overflow-hidden bg-background pt-10">
      <div className="fixed inset-x-0 top-0 z-50 flex h-10 items-center gap-2 border-b border-sky-500/30 bg-sky-600 px-3 text-[13px] font-bold uppercase tracking-wider text-white shadow-sm md:px-5">
        <button
          type="button"
          onClick={() => setNavOpen(true)}
          className="-ml-1 inline-flex h-8 w-8 items-center justify-center rounded-sm hover:bg-white/10 md:hidden"
          aria-label="Open menu"
        >
          <Menu className="h-5 w-5" />
        </button>
        <ClipboardList className="hidden h-4 w-4 md:inline" />
        Dispatcher Console
      </div>
      <div className="flex min-h-0 flex-1">
        <aside className="hidden h-full w-64 shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground md:flex">
        <div className="border-b border-sidebar-border px-4 py-5">
          <Logo variant="light" />
        </div>
        {NewWorkOrderButton}
        {NavList}
        {SignOutFooter}
      </aside>

      {navOpen && (
        <div className="fixed inset-0 z-50 md:hidden" role="dialog" aria-modal="true">
          <button
            type="button"
            aria-label="Close menu"
            onClick={() => setNavOpen(false)}
            className="absolute inset-0 bg-black/50"
          />
          <aside className="absolute inset-y-0 left-0 flex w-[82vw] max-w-[300px] flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground pb-[env(safe-area-inset-bottom,0px)]">
            <div className="flex items-center justify-between border-b border-sidebar-border px-4 py-4">
              <Logo variant="light" />
              <button
                type="button"
                onClick={() => setNavOpen(false)}
                className="inline-flex h-9 w-9 items-center justify-center rounded-sm text-sidebar-foreground/70 hover:bg-sidebar-accent/40"
                aria-label="Close menu"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            {NewWorkOrderButton}
            {NavList}
            {SignOutFooter}
          </aside>
        </div>
      )}

      <div className="flex min-w-0 min-h-0 flex-1 flex-col">
        <header className="flex h-16 items-center justify-between gap-2 border-b border-border bg-card px-3 md:px-7">
          <div className="flex min-w-0 items-center gap-2 md:gap-3">
            <div className="inline-flex items-center rounded-sm bg-sky-500/10 px-2 py-1.5 text-[11px] font-bold uppercase tracking-wider text-sky-700 ring-1 ring-inset ring-sky-400/30 sm:px-2.5 sm:text-xs">
              <ClipboardList className="h-4 w-4 sm:mr-1.5" />
              <span className="hidden sm:inline">Dispatcher</span>
            </div>
            <span className="hidden min-w-0 items-center gap-2 truncate text-[15px] font-medium text-foreground sm:flex">
              <UserAvatar url={profile?.avatar_url} name={profile?.full_name || profile?.email} size={28} />
              <span className="truncate">{profile?.full_name || profile?.email}</span>
            </span>
          </div>
          <div className="flex shrink-0 items-center gap-1 md:gap-2">
            <GlobalSearchButton />
            <span className="hidden sm:inline-flex">
              <CreateWorkOrderDialog triggerLabel="New work order" />
            </span>
            <span className="sm:hidden">
              <CreateWorkOrderDialog triggerLabel="" />
            </span>
            <NotificationBell onOpenPreferences={() => setPrefsOpen(true)} />
            <Link
              to="/account"
              className="hidden items-center gap-2 rounded-sm border border-border bg-background px-3 py-2 text-sm font-medium text-foreground hover:bg-accent sm:inline-flex"
            >
              Account
            </Link>
            <button
              onClick={() => void signOut()}
              className="inline-flex items-center gap-2 rounded-sm border border-border bg-background px-2.5 py-2 text-sm font-medium text-foreground hover:bg-accent md:px-3"
              aria-label="Sign out"
            >
              <LogOut className="h-4 w-4" />
              <span className="hidden md:inline">Sign out</span>
            </button>
          </div>
        </header>
        <main className="flex-1 overflow-x-hidden overflow-y-auto p-3 sm:p-5 md:p-7">{children}</main>
      </div>
      </div>
      <EngineerUnavailableToaster />
      <NotificationPreferencesDialog
        open={prefsOpen}
        onOpenChange={setPrefsOpen}
        role="dispatcher"
      />
    </div>
  );
}