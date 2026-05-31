import { useSchedulingRecommendations } from "@/hooks/useRecommendations";
import { RecommendationPanel } from "./RecommendationPanel";
import type { WorkOrderWithRelations } from "@/types/workOrders";

export function SchedulingSuggestionCard({
  workOrder,
}: {
  workOrder: WorkOrderWithRelations | null | undefined;
}) {
  const suggestions = useSchedulingRecommendations(workOrder);
  return (
    <RecommendationPanel
      title="Scheduling recommendations"
      targetType="work_order"
      targetId={workOrder?.id ?? null}
      suggestions={suggestions}
    />
  );
}