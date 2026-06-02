import { useState } from "react";
import { useAssignmentSuggestions } from "@/hooks/useAssignmentSuggestions";
import { EngineerMatchBadge } from "./EngineerMatchBadge";
import { MatchReasonList } from "./MatchReasonList";
import { cn } from "@/lib/utils";
import type { IntakeRecord } from "@/types/intake";
import type { IntakeExtractedFields, IntakeSuggestedCategorization } from "@/types/intake";
import { Users, AlertTriangle, ChevronDown, ChevronRight } from "lucide-react";
import type { EngineerMatch } from "@/lib/engineerMatching";

interface Props {
  record: IntakeRecord | null;
  /** Live drawer edits — used so suggestions reflect what dispatcher is about to save. */
  extracted?: IntakeExtractedFields;
  categorization?: IntakeSuggestedCategorization;
}

type SortMode = "best_fit" | "load" | "lead_first";

export function AssignmentSuggestionPanel({ record, extracted, categorization }: Props) {
  const liveRecord = record
    ? {
        ...record,
        extracted_fields_json: extracted ?? record.extracted_fields_json,
        suggested_categorization_json: categorization ?? record.suggested_categorization_json,
      }
    : null;

  const { suggestion, isLoading } = useAssignmentSuggestions({ record: liveRecord });
  const [expanded, setExpanded] = useState(false);
  const [sort, setSort] = useState<SortMode>("best_fit");
  const [hideUnsuitable, setHideUnsuitable] = useState(true);

  if (!record) return null;

  return (
    <section className="rounded-md border border-border bg-card">
      <div className="flex items-center justify-between border-b border-border px-3 py-2">
        <div className="flex items-center gap-2">
          <Users className="h-3.5 w-3.5 text-muted-foreground" />
          <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Suggested engineers
          </div>
          {suggestion?.context.primaryTrade && (
            <span className="rounded-sm border border-border px-1.5 py-0.5 text-[10px] text-muted-foreground">
              {suggestion.context.primaryTrade}
            </span>
          )}
          {suggestion?.context.postcodeZone && (
            <span className="rounded-sm border border-border px-1.5 py-0.5 text-[10px] text-muted-foreground">
              {suggestion.context.postcodeZone}
            </span>
          )}
          {suggestion?.context.engineersRequired && suggestion.context.engineersRequired > 1 && (
            <span className="rounded-sm border border-border px-1.5 py-0.5 text-[10px] text-muted-foreground">
              {suggestion.context.engineersRequired} engineers
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as SortMode)}
            className="h-6 rounded-sm border border-border bg-background px-1 text-[11px]"
          >
            <option value="best_fit">Best fit</option>
            <option value="load">Lowest load</option>
            <option value="lead_first">Lead-capable first</option>
          </select>
          <label className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
            <input
              type="checkbox"
              checked={hideUnsuitable}
              onChange={(e) => setHideUnsuitable(e.target.checked)}
              className="h-3 w-3"
            />
            Hide unsuitable
          </label>
        </div>
      </div>

      <div className="p-3">
        {isLoading ? (
          <div className="h-16 animate-pulse rounded-md bg-muted/40" />
        ) : !suggestion ? (
          <div className="text-xs text-muted-foreground">No suggestion available.</div>
        ) : (
          <SuggestionBody
            suggestion={suggestion}
            expanded={expanded}
            onToggle={() => setExpanded((x) => !x)}
            sort={sort}
            hideUnsuitable={hideUnsuitable}
          />
        )}
      </div>
    </section>
  );
}

function SuggestionBody({
  suggestion,
  expanded,
  onToggle,
  sort,
  hideUnsuitable,
}: {
  suggestion: ReturnType<typeof useAssignmentSuggestions>["suggestion"];
  expanded: boolean;
  onToggle: () => void;
  sort: SortMode;
  hideUnsuitable: boolean;
}) {
  if (!suggestion) return null;
  const { lead, supports, matches, warnings, context } = suggestion;

  const sorted = [...matches].sort((a, b) => {
    if (sort === "load") return a.activeLoad - b.activeLoad || b.score - a.score;
    if (sort === "lead_first") {
      const aL = a.leadSuitable ? 0 : 1;
      const bL = b.leadSuitable ? 0 : 1;
      if (aL !== bL) return aL - bL;
      return b.score - a.score;
    }
    return 0; // best_fit — already in default order
  });

  const filtered = hideUnsuitable
    ? sorted.filter((m) => m.strength !== "unsuitable")
    : sorted;

  return (
    <div className="space-y-3">
      {warnings.length > 0 && (
        <div className="rounded-md border border-amber-300/50 bg-amber-50/60 p-2 text-[11px] text-amber-900 dark:border-amber-700/50 dark:bg-amber-900/20 dark:text-amber-200">
          <div className="flex items-center gap-1 font-semibold">
            <AlertTriangle className="h-3 w-3" /> Matching warnings
          </div>
          <ul className="mt-1 list-disc space-y-0.5 pl-4">
            {warnings.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        </div>
      )}

      {lead ? (
        <LeadSupportSuggestionRow lead={lead} supports={supports} engineersRequired={context.engineersRequired} />
      ) : (
        <div className="rounded-md border border-dashed border-border p-2 text-xs text-muted-foreground">
          No strong lead engineer match. Dispatcher selection required.
        </div>
      )}

      <div>
        <button
          type="button"
          onClick={onToggle}
          className="inline-flex items-center gap-1 text-[11px] font-medium text-muted-foreground hover:text-foreground"
        >
          {expanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
          All candidates ({filtered.length})
        </button>
        {expanded && (
          <ul className="mt-2 divide-y divide-border rounded-md border border-border">
            {filtered.map((m) => (
              <MatchRow key={m.engineer.id} match={m} />
            ))}
            {filtered.length === 0 && (
              <li className="px-3 py-2 text-xs text-muted-foreground">No candidates match the current criteria.</li>
            )}
          </ul>
        )}
      </div>

      <div className="text-[10px] text-muted-foreground">
        Suggestion is informational — dispatcher chooses the final assignment.
      </div>
    </div>
  );
}

function LeadSupportSuggestionRow({
  lead,
  supports,
  engineersRequired,
}: {
  lead: EngineerMatch;
  supports: EngineerMatch[];
  engineersRequired: number;
}) {
  return (
    <div className="space-y-2 rounded-md border border-border bg-muted/30 p-2">
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-sm bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-primary">
          Lead
        </span>
        <span className="text-sm font-medium text-foreground">{lead.engineer.display_name}</span>
        <EngineerMatchBadge strength={lead.strength} score={lead.score} />
        {lead.engineer.engineer_code && (
          <span className="text-[10px] text-muted-foreground">#{lead.engineer.engineer_code}</span>
        )}
      </div>
      <MatchReasonList reasons={lead.reasons} blockers={lead.blockers} />

      {engineersRequired > 1 && (
        <div className="space-y-1.5 border-t border-border pt-2">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Support ({supports.length}/{engineersRequired - 1})
          </div>
          {supports.length === 0 && (
            <div className="text-[11px] text-muted-foreground">No suitable support engineers identified.</div>
          )}
          {supports.map((s) => (
            <div key={s.engineer.id} className="flex flex-wrap items-center gap-2">
              <span className="rounded-sm bg-secondary/40 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-secondary-foreground">
                Support
              </span>
              <span className="text-sm text-foreground">{s.engineer.display_name}</span>
              <EngineerMatchBadge strength={s.strength} score={s.score} />
              <span className="text-[10px] text-muted-foreground">
                {s.reasons
                  .filter((r) => r.tone === "positive")
                  .slice(0, 2)
                  .map((r) => r.label)
                  .join(" · ")}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function MatchRow({ match }: { match: EngineerMatch }) {
  return (
    <li
      className={cn(
        "px-3 py-2",
        match.strength === "unsuitable" && "opacity-60",
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-foreground">{match.engineer.display_name}</span>
          {null && (
            <span className="text-[10px] text-muted-foreground">{null}</span>
          )}
          {match.engineer.can_lead && (
            <span className="rounded-sm border border-border px-1 py-0.5 text-[9px] uppercase tracking-wider text-muted-foreground">
              Lead-cap.
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-muted-foreground">load {match.activeLoad}</span>
          <EngineerMatchBadge strength={match.strength} score={match.score} />
        </div>
      </div>
      <MatchReasonList reasons={match.reasons} blockers={match.blockers} className="mt-1" />
    </li>
  );
}