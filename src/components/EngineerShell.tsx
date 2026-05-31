import { Link, useRouterState } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import {
  CalendarDays,
  Wrench,
  MessageSquare,
  Contact,
  LogOut,
  Menu,
  X,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { UserAvatar } from "@/components/account/UserAvatar";
import { Logo } from "./Logo";
import { BossShell } from "@/components/boss/BossShell";
import { MobileSyncBanner } from "./engineer/MobileSyncBanner";
import { InstallAppPrompt } from "./engineer/InstallAppPrompt";
import { NotificationBell } from "./notifications/NotificationBell";
import { NotificationPreferencesDialog } from "./notifications/NotificationPreferencesDialog";

const NAV = [
  { label: "Diary", to: "/engineer", icon: CalendarDays, enabled: true },
  { label: "Jobs", to: "/engineer/jobs", icon: Wrench, enabled: true },
  { label: "Messages", to: "/messages", icon: MessageSquare, enabled: true },
  { label: "Contacts", to: "/contacts", icon: Contact, enabled: true },
] as const;

export function EngineerShell({ children }: { children: ReactNode }) {
  const { profile, signOut } = useAuth();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [prefsOpen, setPrefsOpen] = useState(false);
  const [navOpen, setNavOpen] = useState(false);
  useEffect(() => { setNavOpen(false); }, [pathname]);

  if (profile?.role === "boss") {
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

  const NavList = (
    <nav className="flex-1 overflow-y-auto px-2 py-4">
      {NAV.map((item) => {
        const Icon = item.icon;
        const active = pathname === item.to;
        if (item.enabled) {
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
            className={`mb-0.5 flex w-full items-center gap-3 rounded-sm px-3 py-2.5 text-left text-[15px] text-sidebar-foreground/40 disabled:cursor-not-allowed`}
          >
            <Icon className="h-[18px] w-[18px]" />
            <span>{item.label}</span>
          </button>
        );
      })}
    </nav>
  );

  return (
    <div className="flex min-h-screen w-full flex-col bg-background pt-10">
      <div className="fixed inset-x-0 top-0 z-50 flex h-10 items-center gap-2 border-b border-emerald-500/30 bg-emerald-600 px-3 text-[13px] font-bold uppercase tracking-wider text-white shadow-sm md:px-5">
        <button
          type="button"
          onClick={() => setNavOpen(true)}
          className="-ml-1 inline-flex h-8 w-8 items-center justify-center rounded-sm hover:bg-white/10 md:hidden"
          aria-label="Open menu"
        >
          <Menu className="h-5 w-5" />
        </button>
        <Wrench className="hidden h-4 w-4 md:inline" />
        Engineer Console
      </div>

      <div className="flex flex-1">
        {/* Desktop sidebar */}
        <aside className="hidden w-64 shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground md:flex">
          <div className="border-b border-sidebar-border px-4 py-5">
            <Logo variant="light" />
          </div>
          {NavList}
          {SignOutFooter}
        </aside>

        {/* Mobile drawer */}
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
              {NavList}
              {SignOutFooter}
            </aside>
          </div>
        )}

        <div className="flex min-w-0 flex-1 flex-col">
          {/* Header inside main area */}
          <header className="flex h-16 items-center justify-between gap-2 border-b border-border bg-card px-3 md:px-7">
            <div className="flex min-w-0 items-center gap-2 md:gap-3">
              <div className="inline-flex items-center rounded-sm bg-emerald-500/10 px-2.5 py-1.5 text-xs font-bold uppercase tracking-wider text-emerald-700 ring-1 ring-inset ring-emerald-400/30">
                <Wrench className="mr-1.5 h-4 w-4" />
                Engineer
              </div>
              <span className="hidden min-w-0 items-center gap-2 truncate text-[15px] font-medium text-foreground sm:flex">
                <UserAvatar url={profile?.avatar_url} name={profile?.full_name || profile?.email} size={28} />
                <span className="truncate">{profile?.full_name || profile?.email}</span>
              </span>
            </div>
            <div className="flex items-center gap-1.5 md:gap-2">
              <NotificationBell compact onOpenPreferences={() => setPrefsOpen(true)} />
              <Link
                to="/account"
                className="inline-flex items-center gap-1.5 rounded-sm border border-border bg-background px-3 py-2 text-sm font-medium text-foreground hover:bg-accent"
                aria-label="Account"
              >
                Account
              </Link>
            </div>
          </header>

          <MobileSyncBanner />
          <InstallAppPrompt />

          <main className="flex-1 overflow-y-auto overscroll-contain px-4 pb-5 pt-4">
            {children}
          </main>
        </div>
      </div>

      <NotificationPreferencesDialog
        open={prefsOpen}
        onOpenChange={setPrefsOpen}
        role="engineer"
      />
    </div>
  );
}
