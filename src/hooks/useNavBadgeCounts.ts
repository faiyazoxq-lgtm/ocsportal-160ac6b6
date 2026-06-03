import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { useDirectThreads } from "./useDirectThreads";
import { ATTENTION_STATUSES } from "@/types/workOrders";

export function useNavBadgeCounts() {
  const { profile } = useAuth();
  const enabled = !!profile?.id;

  const attention = useQuery({
    enabled,
    queryKey: ["nav-badge", "attention"],
    refetchInterval: 60_000,
    queryFn: async () => {
      const { count, error } = await supabase
        .from("work_orders")
        .select("id", { count: "exact", head: true })
        .in("current_status", ATTENTION_STATUSES);
      if (error) throw error;
      return count ?? 0;
    },
  });

  const review = useQuery({
    enabled,
    queryKey: ["nav-badge", "review"],
    refetchInterval: 60_000,
    queryFn: async () => {
      const { count, error } = await supabase
        .from("parsing_reviews")
        .select("id", { count: "exact", head: true })
        .eq("review_status", "open");
      if (error) throw error;
      return count ?? 0;
    },
  });

  const intake = useQuery({
    enabled,
    queryKey: ["nav-badge", "intake"],
    refetchInterval: 60_000,
    queryFn: async () => {
      const { count, error } = await supabase
        .from("intake_records")
        .select("id", { count: "exact", head: true })
        .in("parse_status", [
          "received",
          "parsing",
          "parsed",
          "needs_review",
          "duplicate_suspected",
        ]);
      if (error) throw error;
      return count ?? 0;
    },
  });

  const followUps = useQuery({
    enabled,
    queryKey: ["nav-badge", "follow-ups"],
    refetchInterval: 60_000,
    queryFn: async () => {
      const { count, error } = await supabase
        .from("communication_log_entries")
        .select("id", { count: "exact", head: true })
        .eq("requires_follow_up", true)
        .is("follow_up_resolved_at", null);
      if (error) throw error;
      return count ?? 0;
    },
  });

  const threads = useDirectThreads();
  const messages = (threads.data ?? []).reduce(
    (sum, t) => sum + (t.unread_count ?? 0),
    0,
  );

  return {
    "/admin/attention": attention.data ?? 0,
    "/admin/review": review.data ?? 0,
    "/admin/communications": followUps.data ?? 0,
    "/messages": messages,
    "/admin/intake": intake.data ?? 0,
  } as Record<string, number>;
}