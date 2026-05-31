import { Link, useRouterState } from "@tanstack/react-router";
import type { ReactNode } from "react";
import {
  CalendarDays,
  Wrench,
  MessageSquare,
  Contact,
  LogOut,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { UserAvatar } from "@/components/account/UserAvatar";
import { Logo } from "./Logo";
import { MobileSyncBanner } from "./engineer/MobileSyncBanner";
import { InstallAppPrompt } from "./engineer/InstallAppPrompt";
import { NotificationBell } from "./notifications/NotificationBell";
import { NotificationPreferencesDialog } from "./notifications/NotificationPreferencesDialog";
import { useState } from "react";

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

  return (
    <div className="flex min-h-screen w-full flex-col bg-background pt-9">
      <div className="fixed inset-x-0 top-0 z-50 flex h-9 items-center gap-2 border-b border-emerald-500/30 bg-emerald-600 px-4 text-xs font-bold uppercase tracking-wider text-white shadow-sm">
        <Wrench className="h-4 w-4" />
        Engineer Console
      </div>
      <header className="sticky top-9 z-20 flex h-14 items-center justify-between border-b border-border bg-card px-4">
        <Logo />
        <div className="flex items-center gap-2">
          <NotificationBell compact onOpenPreferences={() => setPrefsOpen(true)} />
          <Link
            to="/account"
            className="inline-flex items-center gap-1.5 rounded-sm border border-border bg-background px-2.5 py-1.5 text-xs font-medium text-foreground hover:bg-accent"
            aria-label="Account"
          >
            Account
          </Link>
          <button
            onClick={() => void signOut()}
            className="inline-flex items-center gap-1.5 rounded-sm border border-border bg-background px-2.5 py-1.5 text-xs font-medium text-foreground hover:bg-accent"
            aria-label="Sign out"
          >
            <LogOut className="h-3.5 w-3.5" />
          </button>
        </div>
      </header>

      <div className="border-b border-border bg-card px-4 py-2">
        <div className="flex items-center justify-between">
          <div className="inline-flex items-center rounded-sm bg-emerald-500/10 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider text-emerald-700 ring-1 ring-inset ring-emerald-400/30">
            <Wrench className="mr-1.5 h-3.5 w-3.5" />
            Engineer Console
          </div>
          <span className="flex items-center gap-2 text-sm font-medium text-foreground">
            <UserAvatar url={profile?.avatar_url} name={profile?.full_name || profile?.email} size={24} />
            {profile?.full_name || profile?.email}
          </span>
        </div>
      </div>

      <MobileSyncBanner />
      <InstallAppPrompt />

      <main className="flex-1 overflow-y-auto overscroll-contain px-4 pb-[calc(env(safe-area-inset-bottom,0px)+5rem)] pt-4">
        {children}
      </main>

      <nav
        className="fixed inset-x-0 bottom-0 z-20 grid grid-cols-4 border-t border-border bg-card pb-[env(safe-area-inset-bottom,0px)]"
        aria-label="Engineer navigation"
      >
        {NAV.map((item) => {
          const Icon = item.icon;
          const active = pathname === item.to;
          if (item.enabled) {
            return (
              <Link
                key={item.label}
                to={item.to}
                aria-current={active ? "page" : undefined}
                className={`flex min-h-[52px] flex-col items-center justify-center gap-0.5 py-2 text-[11px] font-medium transition-colors active:bg-accent/40 ${
                  active
                    ? "text-primary"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Icon className="h-5 w-5" aria-hidden />
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
              className={`flex min-h-[52px] flex-col items-center justify-center gap-0.5 py-2 text-[11px] font-medium transition-colors disabled:cursor-not-allowed ${
                active
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon className="h-5 w-5" aria-hidden />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>
      <NotificationPreferencesDialog
        open={prefsOpen}
        onOpenChange={setPrefsOpen}
        role="engineer"
      />
    </div>
  );
}