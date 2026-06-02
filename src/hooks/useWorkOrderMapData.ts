import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { geocodeWorkOrders } from "@/lib/geocoding.functions";
import type { WorkOrderStatus, PriorityLevel } from "@/types/workOrders";

export interface MapWorkOrder {
  id: string;
  order_no: string;
  current_status: WorkOrderStatus;
  priority_level: PriorityLevel;
  postcode: string | null;
  postcode_zone: string | null;
  address_line_1: string | null;
  city: string | null;
  latitude: number | null;
  longitude: number | null;
  job_summary: string | null;
  diary_date: string | null;
  client_id: string | null;
  client_name: string | null;
  assigned_engineer_names: string[];
  geocoded_at: string | null;
  geocode_confidence: number | null;
}

export interface MapFilters {
  statuses?: WorkOrderStatus[];
  trade?: string;
  priority?: string;
  zone?: string;
  clientId?: string;
  engineerId?: string;
  dateFrom?: string; // ISO date
  dateTo?: string;
}

const DEFAULT_STATUSES: WorkOrderStatus[] = [
  "ready_for_dispatch",
  "scheduled_in_sheet",
  "assigned",
  "accepted",
  "en_route",
  "on_site",
  "field_in_progress",
  "field_submitted_incomplete",
  "follow_up_required",
];

export function useWorkOrderMapData(filters: MapFilters = {}) {
  return useQuery({
    queryKey: ["work_orders", "map", filters],
    queryFn: async (): Promise<MapWorkOrder[]> => {
      const statuses = filters.statuses?.length ? filters.statuses : DEFAULT_STATUSES;
      let q = supabase
        .from("work_orders")
        .select(
          `id, order_no, current_status, priority_level, primary_trade, postcode, postcode_zone,
           address_line_1, city, latitude, longitude, job_summary, diary_date, client_id,
           geocoded_at, geocode_confidence,
           client:clients ( client_name ),
           assignments:work_order_assignments (
             assignment_status, assignment_role,
             engineer:engineers ( id, display_name )
           )`,
        )
        .in("current_status", statuses)
        .order("created_at", { ascending: false })
        .limit(500);

      if (filters.trade) q = q.ilike("primary_trade", `%${filters.trade}%`);
      if (filters.priority) q = q.eq("priority_level", filters.priority as PriorityLevel);
      if (filters.zone) q = q.eq("postcode_zone", filters.zone);
      if (filters.clientId) q = q.eq("client_id", filters.clientId);
      if (filters.dateFrom) q = q.gte("diary_date", filters.dateFrom);
      if (filters.dateTo) q = q.lte("diary_date", filters.dateTo);

      const { data, error } = await q;
      if (error) throw error;

      const rows = (data ?? []) as unknown as Array<
        MapWorkOrder & {
          client: { client_name: string } | null;
          assignments: Array<{
            assignment_status: string;
            assignment_role: string;
            engineer: { id: string; display_name: string } | null;
          }>;
        }
      >;

      let mapped = rows.map((r) => ({
        id: r.id,
        order_no: r.order_no,
        current_status: r.current_status,
        priority_level: r.priority_level,
        postcode: r.postcode,
        postcode_zone: r.postcode_zone,
        address_line_1: r.address_line_1,
        city: r.city,
        latitude: r.latitude,
        longitude: r.longitude,
        job_summary: r.job_summary,
        diary_date: r.diary_date,
        client_id: r.client_id,
        client_name: r.client?.client_name ?? null,
        assigned_engineer_names: r.assignments
          .filter((a) => a.assignment_status !== "removed" && a.engineer)
          .map((a) => a.engineer!.display_name),
        geocoded_at: r.geocoded_at,
        geocode_confidence: r.geocode_confidence,
        _engineerIds: r.assignments
          .filter((a) => a.engineer)
          .map((a) => a.engineer!.id),
      }));

      if (filters.engineerId) {
        mapped = mapped.filter((m) =>
          (m as unknown as { _engineerIds: string[] })._engineerIds.includes(filters.engineerId!),
        );
      }

      return mapped.map((m) => {
        const { _engineerIds: _ignored, ...rest } = m as unknown as MapWorkOrder & {
          _engineerIds: string[];
        };
        void _ignored;
        return rest;
      });
    },
    staleTime: 30_000,
  });
}

export function useGeocodingStatus(workOrders: MapWorkOrder[] | undefined) {
  const list = workOrders ?? [];
  const total = list.length;
  const located = list.filter((w) => w.latitude != null && w.longitude != null).length;
  const missing = list.filter(
    (w) => (w.latitude == null || w.longitude == null) && !!w.postcode,
  );
  const unresolvable = list.filter(
    (w) => (w.latitude == null || w.longitude == null) && !w.postcode,
  );
  return {
    total,
    located,
    missingCount: missing.length,
    missingIds: missing.map((m) => m.id),
    unresolvableCount: unresolvable.length,
  };
}

export function useGeocodeRunner() {
  const qc = useQueryClient();
  const fn = useServerFn(geocodeWorkOrders);
  return useMutation({
    mutationFn: async (vars: { workOrderIds?: string[]; limit?: number }) => {
      return fn({ data: { workOrderIds: vars.workOrderIds, limit: vars.limit ?? 25 } });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["work_orders"] });
    },
  });
}