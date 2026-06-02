import { useMemo, useState } from "react";
import { Search, Phone, Mail, Building2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useExternalContacts } from "@/hooks/useExternalContacts";
import { ContactEmptyState } from "./ContactEmptyState";

export function ExternalContactsTab() {
  const { data, isLoading, error } = useExternalContacts();
  const [q, setQ] = useState("");

  const rows = useMemo(() => {
    const list = (data ?? []).filter((r) => !r.archived_at);
    const ql = q.trim().toLowerCase();
    if (!ql) return list;
    return list.filter((r) =>
      [r.name, r.phone, r.email, r.organization, r.contact_type]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(ql),
    );
  }, [data, q]);

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="pointer-events-none absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search external contacts…"
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
        <ContactEmptyState
          title="No external contacts yet"
          hint="Add suppliers, agencies and other third parties from People & Roles."
        />
      ) : (
        <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map((r) => (
            <li key={r.id} className="rounded-md border border-border bg-card p-3 text-sm">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="truncate font-semibold text-foreground">{r.name}</div>
                  {r.organization ? (
                    <div className="mt-0.5 flex items-center gap-1 truncate text-xs text-muted-foreground">
                      <Building2 className="h-3 w-3 shrink-0" />
                      <span className="truncate">{r.organization}</span>
                    </div>
                  ) : null}
                </div>
                {r.contact_type ? (
                  <span className="shrink-0 rounded-sm bg-sky-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-sky-900">
                    {r.contact_type}
                  </span>
                ) : null}
              </div>
              <div className="mt-2 space-y-0.5 text-xs text-muted-foreground">
                {r.phone ? (
                  <a href={`tel:${r.phone}`} className="flex items-center gap-1.5 hover:underline">
                    <Phone className="h-3 w-3" /> {r.phone}
                  </a>
                ) : null}
                {r.email ? (
                  <div className="flex items-center gap-1.5">
                    <Mail className="h-3 w-3 shrink-0" />
                    <span className="truncate">{r.email}</span>
                  </div>
                ) : null}
                {r.notes ? <p className="line-clamp-2 pt-1">{r.notes}</p> : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}