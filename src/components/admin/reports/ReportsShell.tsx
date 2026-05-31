import { Link, useRouterState } from "@tanstack/react-router";
import type { ReactNode } from "react";

const TABS = [
  { to: "/admin/reports", label: "Overview" },
  { to: "/admin/reports/intake", label: "Intake" },
  { to: "/admin/reports/operations", label: "Operations" },
  { to: "/admin/reports/engineers", label: "Engineers" },
  { to: "/admin/reports/system", label: "System health" },
] as const;

export function ReportsShell({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  return (
    <div className="mx-auto max-w-7xl">
      <header className="mb-4">
        <h1 className="text-lg font-semibold text-foreground">Operations reports</h1>
        <p className="text-sm text-muted-foreground">
          Operational analytics for dispatch and admin teams.
        </p>
      </header>
      <nav className="mb-5 flex flex-wrap gap-1 border-b border-border">
        {TABS.map((t) => {
          const active = pathname === t.to;
          return (
            <Link
              key={t.to}
              to={t.to}
              className={`-mb-px border-b-2 px-3 py-2 text-xs font-medium transition-colors ${
                active
                  ? "border-foreground text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              {t.label}
            </Link>
          );
        })}
      </nav>
      {children}
    </div>
  );
}