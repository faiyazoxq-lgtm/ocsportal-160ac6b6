import { Button } from "@/components/ui/button";
import { useWorkOrderAssignmentSuggestions } from "@/hooks/useAssignmentSuggestions";
import type { WorkOrderWithRelations } from "@/types/workOrders";
import { SuggestedEngineerCard } from "./SuggestedEngineerCard";
import { NoStrongMatchWarning } from "./MatchReasonBadge";

interface Props {
  workOrder: WorkOrderWithRelations | null | undefined;
  selectedLeadId: string;
  selectedSupportIds: string[];
  onPickLead: (id: string) => void;
  onPickSupport: (id: string) => void;
  onApplySuggestedPairing?: (leadId: string, supportIds: string[]) => void;
  limit?: number;
}

/**
 * Ranked, explainable engineer suggestions for a dispatch-ready work order.
 * Advisory only — dispatcher / boss still confirms the final assignment.
 */
export function AssignmentSuggestionPanel({
  workOrder, selectedLeadId, selectedSupportIds,
  onPickLead, onPickSupport, onApplySuggestedPairing, limit = 5,
}: Props) {
  const { suggestion, isLoading } = useWorkOrderAssignmentSuggestions(workOrder);
  if (!workOrder) return null;

  const isDispatchReady =
    workOrder.current_status === "ready_for_dispatch" ||
    workOrder.current_status === "categorized" ||
    workOrder.current_status === "assigned";

  return (
    <section className="rounded-sm border border-border bg-card">
      <header className="flex items-center justify-between border-b border-border px-3 py-2">
        <div>
          <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Suggested engineers
          </h3>
          <p className="text-[10px] text-muted-foreground">
            Ranked by skill, certification, zone, availability, and current load.
          </p>
        </div>
        {suggestion?.lead && onApplySuggestedPairing && (
          <Button
            size="sm"
            variant="outline"
            className="h-7 px-2 text-[11px]"
            onClick={() =>
              onApplySuggestedPairing(
                suggestion.lead!.engineer.id,
                suggestion.supports.map((s) => s.engineer.id),
              )
            }
          >
            Apply suggested pairing
          </Button>
        )}
      </header>

      {!isDispatchReady && (
        <div className="px-3 py-2 text-[11px] text-muted-foreground">
          Suggestions are advisory at this status. Mark the job dispatch-ready for the strongest recommendations.
        </div>
      )}

      {isLoading ? (
        <div className="px-3 py-3 text-xs text-muted-foreground">Loading suggestions…</div>
      ) : !suggestion || suggestion.matches.length === 0 ? (
        <div className="px-3 py-3 text-xs text-muted-foreground">No engineer profiles available.</div>
      ) : (
        <>
          {suggestion.warnings.length > 0 && (
            <div className="px-3 pt-2">
              <NoStrongMatchWarning messages={suggestion.warnings} />
            </div>
          )}
          <ul className="divide-y divide-border">
            {suggestion.matches.slice(0, limit).map((m) => {
              const recommendedRole =
                suggestion.lead?.engineer.id === m.engineer.id
                  ? "lead"
                  : suggestion.supports.some((s) => s.engineer.id === m.engineer.id)
                    ? "support"
                    : null;
              return (
                <SuggestedEngineerCard
                  key={m.engineer.id}
                  match={m}
                  isLead={selectedLeadId === m.engineer.id}
                  isSupport={selectedSupportIds.includes(m.engineer.id)}
                  onPickLead={onPickLead}
                  onPickSupport={onPickSupport}
                  recommendedRole={recommendedRole}
                />
              );
            })}
          </ul>
        </>
      )}
    </section>
  );
}