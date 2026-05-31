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
import { Logo } from "./Logo";
import { MobileSyncBanner } from "./engineer/MobileSyncBanner";
import { InstallAppPrompt } from "./engineer/InstallAppPrompt";
import { NotificationBell } from "./notifications/NotificationBell";

const NAV = [
  { label: "Diary", to: "/engineer", icon: CalendarDays, enabled: true },
  { label: "Jobs", to: "/engineer/jobs", icon: Wrench, enabled: true },
  { label: "Messages", to: "/messages", icon: MessageSquare, enabled: true },
  { label: "Contacts", to: "/contacts", icon: Contact, enabled: true },
] as const;

export function EngineerShell({ children }: { children: ReactNode }) {
  const { profile, signOut } = useAuth();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <div className="flex min-h-screen w-full flex-col bg-background">
      <header className="sticky top-0 z-20 flex h-14 items-center justify-between border-b border-border bg-card px-4">
        <Logo />
        <div className="flex items-center gap-2">
          <NotificationBell compact />
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
        <div className="text-[11px] uppercase tracking-wider text-muted-foreground">
          Engineer
        </div>
        <div className="text-sm font-medium text-foreground">
          {profile?.full_name || profile?.email}
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
    </div>
  );
}