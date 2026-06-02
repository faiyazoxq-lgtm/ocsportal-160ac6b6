import { useMemo, useState } from "react";
import { Search, Phone, Mail } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useTenantContacts } from "@/hooks/useTenantContacts";

export function ClientListTab() {
  const { data, isLoading, error } = useTenantContacts();
  const [q, setQ] = useState("");
  const rows = useMemo(() => {
    const list = (data ?? []).filter((r) => !r.archived_at);
    if (!q) return list;
    const ql = q.toLowerCase();
    return list.filter((r) =>
      [r.name, r.phone, r.email, r.organization]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(ql),
    );
  }, [data, q]);

  return (
    <div>
      <div className="relative mb-3">
        <Search className="pointer-events-none absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search tenant name, phone, email…"
          className="pl-7"
        />
      </div>
      {isLoading ? (
        <div className="rounded-md border border-border bg-card p-4 text-sm text-muted-foreground">
          Loading…
        </div>
      ) : error ? (
        <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-900">
          {(error as Error).message}
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-md border border-dashed border-border bg-card p-8 text-center text-sm text-muted-foreground">
          No tenant clients saved yet. Save tenants from a work order to build this list.
        </div>
      ) : (
        <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map((r) => (
            <li key={r.id} className="rounded-md border border-border bg-card p-3 text-sm">
              <div className="truncate font-semibold text-foreground">{r.name}</div>
              <div className="mt-1 space-y-0.5 text-xs text-muted-foreground">
                {r.phone && (
                  <div className="flex items-center gap-1.5">
                    <Phone className="h-3 w-3" />
                    <a href={`tel:${r.phone}`} className="hover:underline">{r.phone}</a>
                  </div>
                )}
                {r.email && (
                  <div className="flex items-center gap-1.5">
                    <Mail className="h-3 w-3" />
                    <span className="truncate">{r.email}</span>
                  </div>
                )}
                {r.notes && <p className="line-clamp-2 pt-1">{r.notes}</p>}
              </div>
              <div className="mt-2 inline-flex rounded-sm bg-emerald-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-emerald-900">
                Tenant
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}