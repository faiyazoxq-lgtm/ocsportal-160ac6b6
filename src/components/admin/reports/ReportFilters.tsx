import type { ReportFilters as Filters } from "@/hooks/useReports";
import { useReportLookups, useTradeOptions } from "@/hooks/useReports";

const RANGES = [
  { label: "7d", days: 7 },
  { label: "30d", days: 30 },
  { label: "90d", days: 90 },
  { label: "1y", days: 365 },
];

export function ReportFiltersBar({
  filters,
  setFilters,
  setDays,
  show = { client: true, trade: true, engineer: false, zone: true },
  zones,
}: {
  filters: Filters;
  setFilters: (updater: (f: Filters) => Filters) => void;
  setDays: (days: number) => void;
  show?: { client?: boolean; trade?: boolean; engineer?: boolean; zone?: boolean };
  zones?: string[];
}) {
  const lookups = useReportLookups();
  const trades = useTradeOptions();

  const activeDays = Math.round(
    (new Date(filters.to).getTime() - new Date(filters.from).getTime()) / 86_400_000 + 1,
  );

  return (
    <div className="mb-5 flex flex-wrap items-center gap-2 rounded-md border border-border bg-card px-3 py-2">
      <div className="flex items-center gap-1">
        {RANGES.map((r) => (
          <button
            key={r.label}
            type="button"
            onClick={() => setDays(r.days)}
            className={`rounded-sm px-2 py-1 text-xs ${
              activeDays === r.days
                ? "bg-foreground text-background"
                : "border border-border bg-background text-foreground hover:bg-accent"
            }`}
          >
            {r.label}
          </button>
        ))}
      </div>

      {show.client && (
        <select
          className="rounded-sm border border-input bg-background px-2 py-1 text-xs"
          value={filters.clientId ?? ""}
          onChange={(e) => setFilters((f) => ({ ...f, clientId: e.target.value || null }))}
        >
          <option value="">All clients</option>
          {(lookups.data?.clients ?? []).map((c) => (
            <option key={c.id} value={c.id}>{c.client_name}</option>
          ))}
        </select>
      )}
      {show.trade && (
        <select
          className="rounded-sm border border-input bg-background px-2 py-1 text-xs"
          value={filters.trade ?? ""}
          onChange={(e) => setFilters((f) => ({ ...f, trade: e.target.value || null }))}
        >
          <option value="">All trades</option>
          {trades.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
      )}
      {show.engineer && (
        <select
          className="rounded-sm border border-input bg-background px-2 py-1 text-xs"
          value={filters.engineerId ?? ""}
          onChange={(e) => setFilters((f) => ({ ...f, engineerId: e.target.value || null }))}
        >
          <option value="">All engineers</option>
          {(lookups.data?.engineers ?? []).map((e) => (
            <option key={e.id} value={e.id}>{e.display_name}</option>
          ))}
        </select>
      )}
      {show.zone && zones && zones.length > 0 && (
        <select
          className="rounded-sm border border-input bg-background px-2 py-1 text-xs"
          value={filters.zone ?? ""}
          onChange={(e) => setFilters((f) => ({ ...f, zone: e.target.value || null }))}
        >
          <option value="">All zones</option>
          {zones.map((z) => (
            <option key={z} value={z}>{z}</option>
          ))}
        </select>
      )}
    </div>
  );
}