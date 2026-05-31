import { createFileRoute } from "@tanstack/react-router";
import { Link } from "@tanstack/react-router";
import { ClipboardCheck, MapPin, Inbox, RefreshCw, ArrowRight } from "lucide-react";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { DispatcherShell } from "@/components/DispatcherShell";

export const Route = createFileRoute("/admin")({
  head: () => ({ meta: [{ title: "Dispatch Dashboard · OCS" }] }),
  component: AdminPage,
});

const CARDS = [
  {
    label: "Open jobs",
    value: "—",
    hint: "Active work orders across all engineers",
    icon: Inbox,
    to: "/admin/dispatch",
  },
  {
    label: "Awaiting review",
    value: "—",
    hint: "Completed jobs pending dispatcher sign-off",
    icon: ClipboardCheck,
    to: "/admin/review",
  },
  {
    label: "Jobs on site",
    value: "—",
    hint: "Engineers currently attending a site",
    icon: MapPin,
    to: "/admin/map",
  },
  {
    label: "Pending sync",
    value: "—",
    hint: "Field updates queued for upload",
    icon: RefreshCw,
    to: "/admin/dispatch",
  },
] as const;

function AdminPage() {
  return (
    <ProtectedRoute requireRole="dispatcher">
      <DispatcherShell>
        <div className="mx-auto max-w-6xl">
          <header className="mb-6">
            <h1 className="text-lg font-semibold text-foreground">
              Operations overview
            </h1>
            <p className="text-sm text-muted-foreground">
              Snapshot of work order activity across the OCS field operation.
            </p>
          </header>

          <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {CARDS.map((c) => {
              const Icon = c.icon;
              return (
                <Link
                  key={c.label}
                  to={c.to}
                  className="block rounded-md border border-border bg-card p-4 shadow-sm transition-colors hover:bg-accent/40"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                      {c.label}
                    </span>
                    <Icon className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div className="mt-3 text-2xl font-semibold text-foreground">
                    {c.value}
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">{c.hint}</p>
                </Link>
              );
            })}
          </section>

          <section className="mt-8 grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Link
              to="/admin/diary"
              className="group block rounded-md border border-border bg-card transition-colors hover:bg-accent/30"
            >
              <div className="border-b border-border px-4 py-3">
                <h2 className="flex items-center justify-between text-sm font-semibold text-foreground">
                  Today's diary
                  <ArrowRight className="h-3.5 w-3.5 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                </h2>
                <p className="text-xs text-muted-foreground">
                  Open the diary planner to view scheduled visits.
                </p>
              </div>
              <div className="px-4 py-10 text-center text-xs text-muted-foreground">
                Click to open diary planning →
              </div>
            </Link>
            <Link
              to="/admin/review"
              className="group block rounded-md border border-border bg-card transition-colors hover:bg-accent/30"
            >
              <div className="border-b border-border px-4 py-3">
                <h2 className="flex items-center justify-between text-sm font-semibold text-foreground">
                  Review queue
                  <ArrowRight className="h-3.5 w-3.5 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                </h2>
                <p className="text-xs text-muted-foreground">
                  Completed jobs awaiting quality check.
                </p>
              </div>
              <div className="px-4 py-10 text-center text-xs text-muted-foreground">
                Click to open review queue →
              </div>
            </Link>
          </section>
        </div>
      </DispatcherShell>
    </ProtectedRoute>
  );
}