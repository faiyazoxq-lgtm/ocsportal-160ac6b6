import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  DISPATCH_STATUSES,
  REVIEW_STATUSES,
} from "@/types/workOrders";

const ON_SITE_STATUSES = ["en_route", "on_site", "field_in_progress"] as const;

export type OpsCategoryCounts = {
  openJobs: number;
  awaitingReview: number;
  onSite: number;
  pendingSync: number;
};

/**
 * Live counts for the Operations Overview category cards.
 * Each query mirrors the filter rules of the destination list view so the
 * badge and the opened page stay in sync.
 */
export function useOpsCategoryCounts() {
  return useQuery({
    queryKey: ["ops-category-counts"],
    refetchInterval: 30_000,
    staleTime: 15_000,
    queryFn: async (): Promise<OpsCategoryCounts> => {
      const [openJobs, awaitingReview, onSite, pendingSync] = await Promise.all([
        supabase
          .from("work_orders")
          .select("id", { count: "exact", head: true })
          .in("current_status", DISPATCH_STATUSES),
        supabase
          .from("work_orders")
          .select("id", { count: "exact", head: true })
          .in("current_status", REVIEW_STATUSES),
        supabase
          .from("work_orders")
          .select("id", { count: "exact", head: true })
          .in("current_status", ON_SITE_STATUSES as unknown as string[]),
        supabase
          .from("work_order_files")
          .select("id", { count: "exact", head: true })
          .in("sync_status", ["pending", "syncing", "failed"]),
      ]);
      return {
        openJobs: openJobs.count ?? 0,
        awaitingReview: awaitingReview.count ?? 0,
        onSite: onSite.count ?? 0,
        pendingSync: pendingSync.count ?? 0,
      };
    },
  });
}