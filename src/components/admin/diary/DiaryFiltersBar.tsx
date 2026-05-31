export interface DiaryFilters {
  fromDate: string;
  toDate: string;
  trade?: string | null;
  zone?: string | null;
}

export function DiaryFiltersBar({
  filters,
  onChange,
}: {
  filters: DiaryFilters;
  onChange: (f: DiaryFilters) => void;
}) {
  const set = <K extends keyof DiaryFilters>(k: K, v: DiaryFilters[K]) =>
    onChange({ ...filters, [k]: v });

  return (
    <div className="mb-3 flex flex-wrap items-end gap-2 rounded-sm border border-border bg-card p-3">
      <Field label="From" type="date" value={filters.fromDate} onChange={(v) => set("fromDate", v)} />
      <Field label="To" type="date" value={filters.toDate} onChange={(v) => set("toDate", v)} />
      <Field
        label="Trade"
        value={filters.trade ?? ""}
        onChange={(v) => set("trade", v || null)}
        placeholder="e.g. plumbing"
      />
      <Field
        label="Zone"
        value={filters.zone ?? ""}
        onChange={(v) => set("zone", v || null)}
        placeholder="e.g. NW1"
      />
    </div>
  );
}

function Field({
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