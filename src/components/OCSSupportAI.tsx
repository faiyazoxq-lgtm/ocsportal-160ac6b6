import { useMemo, useState } from "react";
import { useRouterState } from "@tanstack/react-router";
import { Sparkles, X, ChevronUp, Lightbulb } from "lucide-react";
import { cn } from "@/lib/utils";

type Guidance = {
  title: string;
  purpose: string;
  next: string[];
  reminders?: string[];
};

/**
 * Curated, route-aware operational guidance. Static rules so suggestions
 * always align with the real workflow (no hallucinated actions).
 */
function guidanceFor(pathname: string): Guidance {
  const p = pathname.toLowerCase();

  if (p.startsWith("/admin/intake")) {
    return {
      title: "Email Intake Queue",
      purpose: "Front door for inbound work — review extraction before converting to a job.",
      next: [
        "Sort by Priority and clear Needs review first",
        "Open a row to verify missing/uncertain fields",
        "Resolve duplicates before converting",
      ],
      reminders: ["Convert only when readiness is Ready"],
    };
  }
  if (p.startsWith("/admin/ops")) {
    return {
      title: "Operations",
      purpose: "System health, sessions and diagnostics.",
      next: ["Check active sessions first", "Investigate any failing health checks"],
    };
  }
  if (p.startsWith("/admin/jobs") || p.startsWith("/admin/dispatch")) {
    return {
      title: "Dispatch",
      purpose: "Assign and track active work orders.",
      next: [
        "Triage unassigned jobs by priority/zone",
        "Check engineer availability before assigning",
      ],
    };
  }
  if (p.startsWith("/admin")) {
    return {
      title: "Admin",
      purpose: "Operator workspace.",
      next: ["Start at the queue that needs the most attention"],
    };
  }
  if (p.startsWith("/boss/infrastructure")) {
    return {
      title: "Infrastructure",
      purpose: "Site-wide settings and toggles.",
      next: [
        "Review Recommended Site Toggles first",
        "Confirm mailbox is connected before enabling intake automation",
      ],
    };
  }
  if (p.startsWith("/boss")) {
    return {
      title: "Boss",
      purpose: "Oversight, finance and configuration.",
      next: ["Check KPIs", "Review anything flagged for attention"],
    };
  }
  if (p.startsWith("/engineer/jobs") || /\/engineer\/job\//.test(p)) {
    return {
      title: "Job",
      purpose: "Complete on-site work and capture evidence.",
      next: [
        "Update status as you progress",
        "Capture photos and complete the checklist",
        "Add receipts/expenses before closing",
      ],
    };
  }
  if (p.startsWith("/engineer")) {
    return {
      title: "Engineer",
      purpose: "Your active and upcoming jobs.",
      next: ["Open the next scheduled job", "Check messages and updates"],
    };
  }
  if (p.startsWith("/contacts")) {
    return {
      title: "Contacts",
      purpose: "Operational contacts directory.",
      next: ["Search by name or role", "Tap a contact to call or message"],
    };
  }

  return {
    title: "OCS Support",
    purpose: "Quick guidance for the current page.",
    next: ["Pick a section from the navigation to get started"],
  };
}

function shouldHide(pathname: string) {
  const p = pathname.toLowerCase();
  return p === "/" || p.startsWith("/auth") || p.startsWith("/login");
}

export function OCSSupportAI() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [open, setOpen] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  const tip = useMemo(() => guidanceFor(pathname), [pathname]);

  if (shouldHide(pathname) || dismissed) return null;

  return (
    <div
      className={cn(
        "fixed z-40 select-none",
        // Sit above mobile bottom nav, tucked into corner on desktop.
        "right-3 bottom-20 sm:right-4 sm:bottom-4",
      )}
      aria-label="OCS Support AI helper"
    >
      {open ? (
        <div className="w-[280px] max-w-[calc(100vw-1.5rem)] rounded-lg border border-border bg-card/95 backdrop-blur shadow-lg">
          <div className="flex items-center gap-2 border-b border-border px-3 py-2">
            <Sparkles className="h-3.5 w-3.5 text-primary" aria-hidden />
            <div className="text-xs font-semibold text-foreground">OCS Support AI</div>
            <div className="ml-auto flex items-center gap-1">
              <button
                onClick={() => setOpen(false)}
                className="rounded-sm p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
                aria-label="Minimize"
              >
                <ChevronUp className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={() => setDismissed(true)}
                className="rounded-sm p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
                aria-label="Dismiss"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
          <div className="space-y-2 px-3 py-2.5">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                {tip.title}
              </div>
              <p className="mt-0.5 text-xs leading-snug text-muted-foreground">{tip.purpose}</p>
            </div>
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Next
              </div>
              <ul className="mt-1 space-y-1">
                {tip.next.map((n, i) => (
                  <li key={i} className="flex gap-1.5 text-xs leading-snug text-foreground">
                    <span className="mt-1 h-1 w-1 shrink-0 rounded-full bg-primary" aria-hidden />
                    <span>{n}</span>
                  </li>
                ))}
              </ul>
            </div>
            {tip.reminders && tip.reminders.length > 0 ? (
              <div className="rounded-md border border-border bg-muted/40 px-2 py-1.5">
                <div className="flex items-start gap-1.5 text-[11px] leading-snug text-muted-foreground">
                  <Lightbulb className="mt-0.5 h-3 w-3 shrink-0 text-amber-500" aria-hidden />
                  <span>{tip.reminders[0]}</span>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      ) : (
        <button
          onClick={() => setOpen(true)}
          className={cn(
            "group inline-flex items-center gap-1.5 rounded-full border border-border bg-card/95 px-3 py-1.5 text-xs font-medium text-foreground shadow-md backdrop-blur",
            "hover:bg-accent hover:text-accent-foreground transition-colors",
          )}
          aria-label="Open OCS Support AI"
          title="OCS Support AI · page tips"
        >
          <Sparkles className="h-3.5 w-3.5 text-primary" aria-hidden />
          <span className="hidden sm:inline">OCS Support AI</span>
          <span className="sm:hidden">Tips</span>
        </button>
      )}
    </div>
  );
}

export default OCSSupportAI;