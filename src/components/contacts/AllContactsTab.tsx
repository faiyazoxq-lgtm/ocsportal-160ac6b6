import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  useCombinedContactsView,
  type CombinedContactKind,
} from "@/hooks/useCombinedContactsView";
import { ContactRowCard } from "./ContactRowCard";
import { ContactEmptyState } from "./ContactEmptyState";

const FILTERS: { id: CombinedContactKind | "all"; label: string }[] = [
  { id: "all", label: "All" },
  { id: "engineer", label: "Engineers" },
  { id: "tenant", label: "Clients" },
  { id: "external", label: "External" },
];

export function AllContactsTab() {
  const { rows, counts, isLoading, error } = useCombinedContactsView();
  const [q, setQ] = useState("");
  const [kind, setKind] = useState<CombinedContactKind | "all">("all");

  const filtered = useMemo(() => {
    const ql = q.trim().toLowerCase();
    return rows.filter((r) => {
      if (kind !== "all" && r.kind !== kind) return false;
      if (!ql) return true;
      return [r.name, r.email, r.phone, r.organization, r.subtitle]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(ql);
    });
  }, [rows, q, kind]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2 rounded-md border border-border bg-muted/30 p-2 text-[11px] text-muted-foreground">
        <span className="font-semibold uppercase tracking-wider">Totals</span>
        <span>
          <span className="font-bold text-foreground tabular-nums">{counts.engineers}</span> engineers
        </span>
        <span>·</span>
        <span>
          <span className="font-bold text-foreground tabular-nums">{counts.clients}</span> clients
        </span>
        <span>·</span>
        <span>
          <span className="font-bold text-foreground tabular-nums">{counts.external}</span> external
        </span>
      </div>
      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search name, phone, email, org…"
            className="pl-7"
          />
        </div>
        <div className="flex gap-1 overflow-x-auto">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              onClick={() => setKind(f.id)}
              className={`shrink-0 rounded-sm border px-2.5 py-1 text-xs font-medium transition ${
                kind === f.id
                  ? "border-foreground bg-foreground text-background"
                  : "border-border bg-background text-muted-foreground hover:text-foreground"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>
      {isLoading ? (
        <div className="rounded-md border border-border bg-card p-4 text-sm text-muted-foreground">
          Loading contacts…
        </div>
      ) : error ? (
        <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-900">
          {(error as Error).message}
        </div>
      ) : filtered.length === 0 ? (
        <ContactEmptyState
          title="No contacts match"
          hint="Try clearing the search or switching the filter."
        />
      ) : (
        <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((r) => (
            <ContactRowCard key={r.key} row={r} />
          ))}
        </ul>
      )}
    </div>
  );
}