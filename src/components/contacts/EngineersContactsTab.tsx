import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useCombinedContactsView } from "@/hooks/useCombinedContactsView";
import { ContactRowCard } from "./ContactRowCard";
import { ContactEmptyState } from "./ContactEmptyState";

export function EngineersContactsTab() {
  const { rows, isLoading, error } = useCombinedContactsView();
  const [q, setQ] = useState("");

  const engineers = useMemo(() => {
    const list = rows.filter((r) => r.kind === "engineer");
    const ql = q.trim().toLowerCase();
    if (!ql) return list;
    return list.filter((r) =>
      [r.name, r.subtitle, r.phone, r.email].filter(Boolean).join(" ").toLowerCase().includes(ql),
    );
  }, [rows, q]);

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="pointer-events-none absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search engineers by name, trade, postcode…"
          className="pl-7"
        />
      </div>
      {isLoading ? (
        <div className="rounded-md border border-border bg-card p-4 text-sm text-muted-foreground">
          Loading engineers…
        </div>
      ) : error ? (
        <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-900">
          {(error as Error).message}
        </div>
      ) : engineers.length === 0 ? (
        <ContactEmptyState
          title="No engineers yet"
          hint="Add engineers from People & Roles to see them here."
        />
      ) : (
        <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {engineers.map((r) => (
            <ContactRowCard key={r.key} row={r} />
          ))}
        </ul>
      )}
    </div>
  );
}