import { Link } from "@tanstack/react-router";
import { Phone, Mail, Send, Building2 } from "lucide-react";
import type { CombinedContactRow } from "@/hooks/useCombinedContactsView";

const KIND_BADGE: Record<CombinedContactRow["kind"], { label: string; cls: string }> = {
  engineer: { label: "Engineer", cls: "bg-orange-100 text-orange-900" },
  staff: { label: "Staff", cls: "bg-slate-100 text-slate-700" },
  tenant: { label: "Tenant", cls: "bg-emerald-100 text-emerald-900" },
  external: { label: "External", cls: "bg-sky-100 text-sky-900" },
};

export function ContactRowCard({ row }: { row: CombinedContactRow }) {
  const badge = KIND_BADGE[row.kind];
  return (
    <li className="flex flex-col rounded-md border border-border bg-card p-3 text-sm">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="truncate font-semibold text-foreground">{row.name}</div>
          {row.subtitle ? (
            <div className="mt-0.5 flex items-center gap-1 truncate text-xs text-muted-foreground">
              {row.organization ? <Building2 className="h-3 w-3 shrink-0" /> : null}
              <span className="truncate">{row.subtitle}</span>
            </div>
          ) : null}
        </div>
        <span
          className={`shrink-0 rounded-sm px-1.5 py-0.5 text-[10px] font-semibold uppercase ${badge.cls}`}
        >
          {badge.label}
        </span>
      </div>
      <div className="mt-2 space-y-0.5 text-xs text-muted-foreground">
        {row.phone ? (
          <a href={`tel:${row.phone}`} className="flex items-center gap-1.5 hover:underline">
            <Phone className="h-3 w-3" /> {row.phone}
          </a>
        ) : null}
        {row.email ? (
          <div className="flex items-center gap-1.5">
            <Mail className="h-3 w-3 shrink-0" />
            <span className="truncate">{row.email}</span>
          </div>
        ) : null}
      </div>
      {row.linkable ? (
        <div className="mt-2 flex items-center gap-2 border-t border-border pt-2">
          <Link
            to="/contacts/$id"
            params={{ id: row.refId }}
            search={{ msg: 1 }}
            className="inline-flex items-center gap-1 rounded-sm border border-border bg-background px-2 py-1 text-[11px] font-medium hover:bg-accent"
          >
            <Send className="h-3 w-3" /> Message
          </Link>
          <Link
            to="/contacts/$id"
            params={{ id: row.refId }}
            className="text-[11px] font-medium text-muted-foreground hover:text-foreground hover:underline"
          >
            Open profile
          </Link>
        </div>
      ) : null}
    </li>
  );
}