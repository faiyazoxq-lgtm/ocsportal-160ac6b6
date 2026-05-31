import { Input } from "@/components/ui/input";
import type { MapFilters } from "@/hooks/useWorkOrderMapData";

export function MapFilterBar({
  value,
  onChange,
}: {
  value: MapFilters;
  onChange: (next: MapFilters) => void;
}) {
  const upd = (patch: Partial<MapFilters>) => onChange({ ...value, ...patch });

  return (
    <div className="grid grid-cols-2 gap-2 md:grid-cols-6">
      <Input
        placeholder="Trade"
        value={value.trade ?? ""}
        onChange={(e) => upd({ trade: e.target.value || undefined })}
      />
      <Input
        placeholder="Postcode zone"
        value={value.zone ?? ""}
        onChange={(e) => upd({ zone: e.target.value || undefined })}
      />
      <select
        className="h-9 rounded-sm border border-input bg-background px-2 text-sm"
        value={value.priority ?? ""}
        onChange={(e) => upd({ priority: e.target.value || undefined })}
      >
        <option value="">Any priority</option>
        <option value="urgent">Urgent</option>
        <option value="high">High</option>
        <option value="normal">Normal</option>
        <option value="low">Low</option>
      </select>
      <Input
        type="date"
        value={value.dateFrom ?? ""}
        onChange={(e) => upd({ dateFrom: e.target.value || undefined })}
      />
      <Input
        type="date"
        value={value.dateTo ?? ""}
        onChange={(e) => upd({ dateTo: e.target.value || undefined })}
      />
      <button
        type="button"
        className="h-9 rounded-sm border border-input bg-background px-3 text-sm hover:bg-muted"
        onClick={() => onChange({})}
      >
        Reset
      </button>
    </div>
  );
}