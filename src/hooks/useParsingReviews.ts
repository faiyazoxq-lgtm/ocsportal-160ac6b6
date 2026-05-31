import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { ParsingReview } from "@/types/workOrders";

export function useParsingReviews() {
  return useQuery({
    queryKey: ["parsing_reviews", "open"],
    queryFn: async (): Promise<ParsingReview[]> => {
      const { data, error } = await supabase
        .from("parsing_reviews")
        .select("*")
        .eq("review_status", "open")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as ParsingReview[];
    },
  });
}