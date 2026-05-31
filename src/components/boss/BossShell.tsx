import { Link, useRouterState } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import {
  LayoutDashboard, Users, ShieldCheck, Activity, LogOut, KeyRound,
  Inbox, AlertTriangle, ClipboardList, CalendarDays, CheckSquare,
  Receipt, PhoneCall, Contact, MessageSquare, Map, BarChart3, Wrench,
  Menu, X,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { Logo } from "@/components/Logo";
import { UserAvatar } from "@/components/account/UserAvatar";
import { CreateWorkOrderDialog } from "@/components/admin/CreateWorkOrderDialog";

const BOSS_NAV = [
  { label: "Command", to: "/boss/overview", icon: LayoutDashboard },
  { label: "People & Roles", to: "/boss/members", icon: Users },
  { label: "Inbox", to: "/boss/inbox", icon: Inbox },
  { label: "Ops & Audit", to: "/boss/ops", icon: Activity },
  { label: "Infrastructure", to: "/boss/infrastructure", icon: ShieldCheck },
] as const;

const OPS_NAV = [
  { label: "Dispatcher Dashboard", to: "/admin", icon: LayoutDashboard },
  { label: "Intake Queue", to: "/admin/intake", icon: Inbox },
  { label: "Admin Attention", to: "/admin/attention", icon: AlertTriangle },
  { label: "Dispatch Board", to: "/admin/dispatch", icon: ClipboardList },
  { label: "Diary", to: "/admin/diary", icon: CalendarDays },
  { label: "Engineers", to: "/admin/engineers", icon: Wrench },
  { label: "Review Queue", to: "/admin/review", icon: CheckSquare },
  { label: "Billing Prep", to: "/admin/billing", icon: Receipt },
  { label: "Follow-ups", to: "/admin/communications", icon: PhoneCall },
  { label: "Contacts", to: "/contacts", icon: Contact },
  { label: "Messages", to: "/messages", icon: MessageSquare },
  { label: "Map View", to: "/admin/map", icon: Map },
  { label: "Reports", to: "/admin/reports", icon: BarChart3 },
  { label: "Ops & QA", to: "/admin/ops", icon: Activity },
] as const;

export function BossShell({ children }: { children: ReactNode }) {
  const { profile, signOut } = useAuth();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [navOpen, setNavOpen] = useState(false);
  // Close drawer whenever route changes
  useEffect(() => { setNavOpen(false); }, [pathname]);

  const NewWorkOrderButton = (
    <div className="px-3 py-2">
      <CreateWorkOrderDialog triggerLabel="New work order" triggerSize="default" triggerVariant="default" />
    </div>
  );

  const NavList = (
    <nav className="flex-1 overflow-y-auto px-2 py-4">
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
      {OPS_NAV.map((item) => {
        const Icon = item.icon;
        const active = pathname === item.to;
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
    </nav>
  );

  const FooterBlock = (
    <div className="border-t border-sidebar-border p-3 text-sm text-sidebar-foreground/70">
      <div className="mb-2 flex items-center gap-2">
        <UserAvatar url={profile?.avatar_url} name={profile?.full_name || profile?.email} size={36} />
        <div className="min-w-0 flex-1 truncate">{profile?.full_name || profile?.email}</div>
      </div>
      <Link
        to="/account"
        className="mb-1 flex w-full items-center gap-2 rounded-sm px-2 py-2 text-[15px] hover:bg-sidebar-accent/40"
      >
        <KeyRound className="h-[18px] w-[18px]" /> Account & password
      </Link>
      <button
        onClick={() => void signOut()}
        className="flex w-full items-center gap-2 rounded-sm px-2 py-2 text-[15px] hover:bg-sidebar-accent/40"
      >
        <LogOut className="h-[18px] w-[18px]" /> Sign out
      </button>
    </div>
  );

  return (
    <div className="flex min-h-screen w-full flex-col bg-background pt-11">
      <div className="fixed inset-x-0 top-0 z-50 flex h-11 items-center gap-2 border-b border-indigo-500/30 bg-indigo-600 px-3 text-sm font-bold uppercase tracking-wider text-white shadow-sm md:px-5">
        <button
          type="button"
          onClick={() => setNavOpen(true)}
          className="-ml-1 inline-flex h-9 w-9 items-center justify-center rounded-sm hover:bg-white/10 md:hidden"
          aria-label="Open menu"
        >
          <Menu className="h-5 w-5" />
        </button>
        <ShieldCheck className="hidden h-[18px] w-[18px] md:inline" />
        Boss Console
      </div>
      <div className="flex flex-1">
        <aside className="hidden w-72 shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground md:flex">
        <div className="border-b border-sidebar-border px-4 py-5">
          <Logo variant="light" />
          <div className="mt-3 inline-flex items-center rounded-sm bg-indigo-500/20 px-2.5 py-1.5 text-xs font-bold uppercase tracking-wider text-indigo-200 ring-1 ring-inset ring-indigo-400/30">
            <ShieldCheck className="mr-1.5 h-[18px] w-[18px]" />
            Boss Console
          </div>
        </div>
        {NewWorkOrderButton}
        {NavList}
        {FooterBlock}
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
            {NavList}
            {FooterBlock}
          </aside>
        </div>
      )}
      <main className="min-w-0 flex-1 overflow-x-hidden">
        <div className="mx-auto max-w-[1400px] px-4 py-5 sm:px-6 sm:py-7 lg:px-8">{children}</div>
      </main>
      </div>
    </div>
  );
}