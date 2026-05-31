import { useAssignmentRecommendations } from "@/hooks/useRecommendations";
import { RecommendationBadge } from "./RecommendationBadge";
import { Button } from "@/components/ui/button";
import type { Engineer } from "@/types/engineers";
import type { WorkOrderWithRelations } from "@/types/workOrders";

interface Props {
  workOrder: WorkOrderWithRelations | null | undefined;
  engineers: Engineer[] | undefined;
  scheduledJobs?: WorkOrderWithRelations[];
  onPickLead?: (engineerId: string) => void;
  onPickSupport?: (engineerId: string) => void;
  selectedLeadId?: string;
  selectedSupportIds?: string[];
  limit?: number;
}

/**
 * Compact, explainable list of top-ranked engineers for a work order.
 * Pure advisory — the dispatcher still confirms the final pick.
 */
export function SmartAssignmentSuggestions({
  workOrder,
  engineers,
  scheduledJobs,
  onPickLead,
  onPickSupport,
  selectedLeadId,
  selectedSupportIds = [],
  limit = 3,
}: Props) {
  const candidates = useAssignmentRecommendations(workOrder, engineers, scheduledJobs);
  if (!workOrder || candidates.length === 0) return null;
  const top = candidates.slice(0, limit);

  return (
    <section className="rounded-sm border border-border bg-card">
      <div className="flex items-center justify-between border-b border-border px-3 py-2">
        <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          Suggested engineers
        </h3>
        <span className="text-[10px] text-muted-foreground">
          ranked by skill · zone · load
        </span>
      </div>
      <ul className="divide-y divide-border">
        {top.map((c) => {
          const isLead = selectedLeadId === c.engineer.id;
          const isSupport = selectedSupportIds.includes(c.engineer.id);
          return (
            <li key={c.engineer.id} className="px-3 py-2 text-xs">
              <div className="flex flex-wrap items-start gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium text-foreground">
                      {c.engineer.display_name}
                    </span>
                    {c.engineer.engineer_code && (
                      <span className="text-[10px] text-muted-foreground">
                        ({c.engineer.engineer_code})
                      </span>
                    )}
                    <RecommendationBadge severity={c.score >= 5 ? "info" : "suggest"}>
                      score {c.score}
                    </RecommendationBadge>
                    {c.suitableAsLead && (
                      <span className="rounded-sm border border-emerald-300 bg-emerald-50 px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-emerald-900 dark:border-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-200">
                        lead-suitable
                      </span>
                    )}
                    {c.warnings.length > 0 && (
                      <RecommendationBadge severity="warn">{c.warnings[0]}</RecommendationBadge>
                    )}
                  </div>
                  <ul className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-muted-foreground">
                    {c.rationale.map((r, i) => (
                      <li key={i}>
                        {r.label}
                        {r.weight != null && r.weight !== 0 && (
                          <span className="ml-0.5 opacity-70">
                            ({r.weight > 0 ? "+" : ""}
                            {r.weight})
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  {onPickLead && (
                    <Button
                      size="sm"
                      variant={isLead ? "default" : "outline"}
                      className="h-7 px-2 text-[11px]"
                      onClick={() => onPickLead(c.engineer.id)}
                      disabled={!c.engineer.can_lead || !c.engineer.active_status}
                      title={!c.engineer.can_lead ? "Not lead-capable" : undefined}
                    >
                      {isLead ? "Lead ✓" : "Use as lead"}
                    </Button>
                  )}
                  {onPickSupport && (
                    <Button
                      size="sm"
                      variant={isSupport ? "default" : "outline"}
                      className="h-7 px-2 text-[11px]"
                      onClick={() => onPickSupport(c.engineer.id)}
                      disabled={isLead}
                    >
                      {isSupport ? "Support ✓" : "Add support"}
                    </Button>
                  )}
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}