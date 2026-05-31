import { useState } from "react";
import { DispatchMapView } from "./DispatchMapView";
import { MapFilterBar } from "./MapFilterBar";
import { WorkOrderDetail } from "@/components/admin/WorkOrderDetail";
import {
  useWorkOrderMapData,
  useGeocodingStatus,
  useGeocodeRunner,
  type MapFilters,
} from "@/hooks/useWorkOrderMapData";
import { Loader2, MapPin } from "lucide-react";

export function WorkOrderMapPanel() {
  const [filters, setFilters] = useState<MapFilters>({});
  const [selected, setSelected] = useState<string | null>(null);
  const [assignTarget, setAssignTarget] = useState<string | null>(null);
  const { data, isLoading, error } = useWorkOrderMapData(filters);
  const status = useGeocodingStatus(data);
  const runner = useGeocodeRunner();

  return (
    <div className="space-y-3">
      <MapFilterBar value={filters} onChange={setFilters} />

      <div className="flex flex-wrap items-center gap-3 rounded-md border border-border bg-card px-3 py-2 text-xs">
        <span className="inline-flex items-center gap-1 text-muted-foreground">
          <MapPin className="h-3 w-3" /> {status.located} of {status.total} jobs located
        </span>
        {status.missingCount > 0 ? (
          <button
            type="button"
            onClick={() => runner.mutate({ workOrderIds: status.missingIds })}
            disabled={runner.isPending}
            className="inline-flex items-center gap-1 rounded-sm border border-border bg-background px-2 py-1 text-xs hover:bg-muted disabled:opacity-50"
          >
            {runner.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
            Geocode {status.missingCount} missing
          </button>
        ) : null}
        {status.unresolvableCount > 0 ? (
          <span className="text-amber-600">
            {status.unresolvableCount} jobs have no postcode and cannot be mapped
          </span>
        ) : null}
        {runner.data ? (
          <span className="text-muted-foreground">
            Last run: {runner.data.geocoded} geocoded, {runner.data.failed} failed
          </span>
        ) : null}
      </div>

      {isLoading ? (
        <div className="rounded-md border border-border bg-card px-3 py-8 text-center text-sm text-muted-foreground">
          Loading map…
        </div>
      ) : error ? (
        <div className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-3 text-sm text-destructive">
          Failed to load: {(error as Error).message}
        </div>
      ) : (
        <DispatchMapView items={data ?? []} onSelect={setSelected} />
      )}

      <WorkOrderDetail
        workOrderId={selected}
        open={!!selected}
        onOpenChange={(o) => !o && setSelected(null)}
        onAssign={(id) => setAssignTarget(id)}
      />
      {assignTarget ? null : null}
    </div>
  );
}