import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getSheetSyncHistory } from "@/lib/plannerSync.functions";

export interface SheetSyncLogRow {
  id: string;
  work_order_id: string | null;
  sheet_name: string | null;
  sheet_row_key: string | null;
  sync_direction: "app_to_sheet" | "sheet_to_app";
  sync_status: "pending" | "success" | "failed" | "conflict" | "skipped";
  payload_snapshot_json: unknown;
  error_message: string | null;
  triggered_by: string | null;
  synced_at: string | null;
  created_at: string;
}

export function useSheetSyncHistory(workOrderId?: string | null) {
  const fetchHistory = useServerFn(getSheetSyncHistory);
  return useQuery({
    queryKey: ["sheet_sync_log", workOrderId ?? "all"],
    queryFn: async () => {
      const r = await fetchHistory({
        data: workOrderId ? { workOrderId, limit: 100 } : { limit: 100 },
      });
      return r.rows as SheetSyncLogRow[];
    },
  });
}