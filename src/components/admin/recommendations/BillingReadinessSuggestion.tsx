import { useBillingRecommendations } from "@/hooks/useRecommendations";
import { RecommendationPanel } from "./RecommendationPanel";
import type { WorkOrderWithRelations } from "@/types/workOrders";
import type { BillingCase } from "@/types/billing";

export function BillingReadinessSuggestion({
  workOrder,
  billingCase,
  expenseCount,
  receiptCount,
  evidenceCount,
}: {
  workOrder: WorkOrderWithRelations | null | undefined;
  billingCase: BillingCase | null | undefined;
  expenseCount: number;
  receiptCount: number;
  evidenceCount: number;
}) {
  const suggestions = useBillingRecommendations(
    workOrder,
    billingCase,
    expenseCount,
    receiptCount,
    evidenceCount,
  );
  return (
    <RecommendationPanel
      title="Billing recommendations"
      targetType="work_order"
      targetId={workOrder?.id ?? null}
      suggestions={suggestions}
    />
  );
}