import { useIntakeRecommendations } from "@/hooks/useRecommendations";
import { RecommendationPanel } from "./RecommendationPanel";
import type { IntakeRecord } from "@/types/intake";

export function IntakeRecommendationSummary({
  record,
}: {
  record: IntakeRecord | null | undefined;
}) {
  const suggestions = useIntakeRecommendations(record);
  return (
    <RecommendationPanel
      title="Intake recommendations"
      targetType="intake_record"
      targetId={record?.id ?? null}
      suggestions={suggestions}
    />
  );
}