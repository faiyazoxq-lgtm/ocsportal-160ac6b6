import { useClients } from "@/hooks/useClients";
import { useEngineers } from "@/hooks/useEngineers";
import { BILLING_STATUSES, BILLING_STATUS_LABEL } from "@/types/billing";
import type { BillingQueueFilters } from "@/hooks/useBilling";

export function BillingFiltersBar({
  filters,
  onChange,
}: {
  filters: BillingQueueFilters;
  onChange: (next: BillingQueueFilters) => void;
}) {
  const { data: clients } = useClients();
  const { data: engineers } = useEngineers();

  const set = <K extends keyof BillingQueueFilters>(k: K, v: BillingQueueFilters[K]) =>
    onChange({ ...filters, [k]: v });

  return (
    <div className="mb-3 flex flex-wrap items-end gap-2 rounded-sm border border-border bg-card p-3">
      <Select
        label="Status"
        value={filters.status ?? "all"}
        onChange={(v) => set("status", v as BillingQueueFilters["status"])}
        options={[
          { value: "all", label: "All statuses" },
          ...BILLING_STATUSES.map((s) => ({ value: s, label: BILLING_STATUS_LABEL[s] })),
        ]}
      />
      <Select
        label="Client"
        value={filters.clientId ?? ""}
        onChange={(v) => set("clientId", v || null)}
        options={[
          { value: "", label: "All clients" },
          ...((clients ?? []).map((c) => ({ value: c.id, label: c.client_name }))),
        ]}
      />
      <Select
        label="Engineer"
        value={filters.engineerId ?? ""}
        onChange={(v) => set("engineerId", v || null)}
        options={[
          { value: "", label: "All engineers" },
          ...((engineers ?? []).map((e) => ({ value: e.id, label: e.display_name }))),
        ]}
      />
      <TextField
        label="Trade"
        value={filters.trade ?? ""}
        onChange={(v) => set("trade", v || null)}
        placeholder="e.g. plumbing"
      />
      <TextField
        label="Zone"
        value={filters.zone ?? ""}
        onChange={(v) => set("zone", v || null)}
        placeholder="e.g. NW1"
      />
      <TextField
        label="From"
        type="date"
        value={filters.fromDate ?? ""}
        onChange={(v) => set("fromDate", v || null)}
      />
      <TextField
        label="To"
        type="date"
        value={filters.toDate ?? ""}
        onChange={(v) => set("toDate", v || null)}
      />
      <button
        type="button"
        onClick={() => onChange({})}
        className="ml-auto rounded-sm border border-border bg-background px-2 py-1.5 text-xs hover:bg-accent"
      >
        Reset
      </button>
    </div>
  );
}

function Select({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <label className="flex flex-col gap-1 text-[11px] uppercase tracking-wide text-muted-foreground">
      {label}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="min-w-32 rounded-sm border border-border bg-background px-2 py-1.5 text-xs text-foreground"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function TextField({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
}) {
  return (
    <label className="flex flex-col gap-1 text-[11px] uppercase tracking-wide text-muted-foreground">
      {label}
      <input
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="w-32 rounded-sm border border-border bg-background px-2 py-1.5 text-xs text-foreground"
      />
    </label>
  );
}