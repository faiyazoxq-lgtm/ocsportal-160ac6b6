import { Button } from "@/components/ui/button";
import { MatchReasonBadge } from "./MatchReasonBadge";
import { STRENGTH_LABEL, STRENGTH_TONE, type EngineerMatch } from "@/lib/engineerMatching";

interface Props {
  match: EngineerMatch;
  isLead: boolean;
  isSupport: boolean;
  onPickLead?: (id: string) => void;
  onPickSupport?: (id: string) => void;
  recommendedRole?: "lead" | "support" | null;
}

export function SuggestedEngineerCard({
  match, isLead, isSupport, onPickLead, onPickSupport, recommendedRole,
}: Props) {
  const e = match.engineer;
  return (
    <li className="px-3 py-2 text-xs">
      <div className="flex flex-wrap items-start gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium text-foreground">{e.display_name}</span>
            {e.engineer_code && (
              <span className="text-[10px] text-muted-foreground">({e.engineer_code})</span>
            )}
            <span className={`rounded-sm border px-1.5 py-0.5 text-[10px] uppercase tracking-wider ${STRENGTH_TONE[match.strength]}`}>
              {STRENGTH_LABEL[match.strength]} · {match.score}
            </span>
            {recommendedRole === "lead" && (
              <span className="rounded-sm border border-primary/40 bg-primary/10 px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-primary">
                Suggested lead
              </span>
            )}
            {recommendedRole === "support" && (
              <span className="rounded-sm border border-sky-300 bg-sky-50 px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-sky-900 dark:border-sky-800 dark:bg-sky-900/20 dark:text-sky-200">
                Suggested support
              </span>
            )}
          </div>
          <div className="mt-1 flex flex-wrap gap-1">
            {match.reasons.map((r) => <MatchReasonBadge key={r.key} reason={r} />)}
            {match.blockers.map((r) => <MatchReasonBadge key={r.key} reason={r} />)}
          </div>
          <div className="mt-1 text-[10px] text-muted-foreground">
            {match.activeLoad} active job{match.activeLoad === 1 ? "" : "s"} ·
            {" "}{e.can_lead ? "lead-capable" : "support only"} · cap 
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {onPickLead && (
            <Button
              size="sm"
              variant={isLead ? "default" : "outline"}
              className="h-7 px-2 text-[11px]"
              onClick={() => onPickLead(e.id)}
              disabled={!e.can_lead || !e.active_status}
              title={!e.can_lead ? "Not lead-capable" : undefined}
            >
              {isLead ? "Lead ✓" : "Use as lead"}
            </Button>
          )}
          {onPickSupport && (
            <Button
              size="sm"
              variant={isSupport ? "default" : "outline"}
              className="h-7 px-2 text-[11px]"
              onClick={() => onPickSupport(e.id)}
              disabled={isLead}
            >
              {isSupport ? "Support ✓" : "Add support"}
            </Button>
          )}
        </div>
      </div>
    </li>
  );
}