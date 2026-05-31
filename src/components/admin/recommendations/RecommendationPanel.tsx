import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronRight, X, Check } from "lucide-react";
import { RecommendationBadge } from "./RecommendationBadge";
import {
  filterActive,
  useAcknowledgeRecommendation,
  useDismissRecommendation,
  useRecommendationState,
} from "@/hooks/useRecommendations";
import type {
  RecommendationSuggestion,
  RecommendationTargetType,
} from "@/types/recommendations";

interface Props {
  title?: string;
  targetType: RecommendationTargetType;
  targetId: string | null | undefined;
  suggestions: RecommendationSuggestion[];
  /** Optional action a dispatcher can take when accepting a suggestion. */
  onAccept?: (s: RecommendationSuggestion) => void;
  acceptLabel?: string;
  className?: string;
}

/**
 * Generic explainable recommendation panel — used in intake, assignment,
 * scheduling, and billing-prep drawers. Recommendations are advisory only;
 * users can dismiss or acknowledge them without changing operational state.
 */
export function RecommendationPanel({
  title = "Recommendations",
  targetType,
  targetId,
  suggestions,
  onAccept,
  acceptLabel = "Apply",
  className,
}: Props) {
  const { data: state } = useRecommendationState(targetType, targetId ?? null);
  const dismissMut = useDismissRecommendation();
  const ackMut = useAcknowledgeRecommendation();
  const visible = filterActive(suggestions, state ?? []);
  if (!targetId || visible.length === 0) return null;

  return (
    <section
      className={`rounded-sm border border-border bg-card ${className ?? ""}`}
      aria-label={title}
    >
      <div className="flex items-center justify-between border-b border-border px-3 py-2">
        <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          {title}
        </h3>
        <span className="text-[10px] text-muted-foreground">advisory · admin-controlled</span>
      </div>
      <ul className="divide-y divide-border">
        {visible.map((s) => (
          <RecommendationRow
            key={s.key}
            suggestion={s}
            onDismiss={() =>
              dismissMut.mutate({ targetType, targetId, suggestion: s })
            }
            onAcknowledge={() =>
              ackMut.mutate({ targetType, targetId, suggestion: s })
            }
            onAccept={onAccept ? () => onAccept(s) : undefined}
            acceptLabel={acceptLabel}
            busy={dismissMut.isPending || ackMut.isPending}
          />
        ))}
      </ul>
    </section>
  );
}

function RecommendationRow({
  suggestion,
  onDismiss,
  onAcknowledge,
  onAccept,
  acceptLabel,
  busy,
}: {
  suggestion: RecommendationSuggestion;
  onDismiss: () => void;
  onAcknowledge: () => void;
  onAccept?: () => void;
  acceptLabel: string;
  busy: boolean;
}) {
  const [open, setOpen] = useState(false);
  return (
    <li className="px-3 py-2 text-xs">
      <div className="flex flex-wrap items-start gap-2">
        <RecommendationBadge severity={suggestion.severity}>
          {suggestion.severity}
        </RecommendationBadge>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-medium text-foreground">{suggestion.title}</div>
          {suggestion.detail && (
            <p className="mt-0.5 text-xs text-muted-foreground">{suggestion.detail}</p>
          )}
          {suggestion.confidence != null && (
            <p className="mt-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">
              confidence {Math.round(suggestion.confidence * 100)}%
            </p>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {onAccept && (
            <Button size="sm" variant="outline" className="h-7 px-2" onClick={onAccept} disabled={busy}>
              {acceptLabel}
            </Button>
          )}
          <Button
            size="sm"
            variant="ghost"
            className="h-7 px-2 text-muted-foreground"
            onClick={onAcknowledge}
            disabled={busy}
            title="Acknowledge — keep the suggestion logged but mark as seen"
          >
            <Check className="h-3.5 w-3.5" />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-7 px-2 text-muted-foreground"
            onClick={onDismiss}
            disabled={busy}
            title="Dismiss"
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="mt-1 inline-flex items-center gap-1 text-[10px] uppercase tracking-wider text-muted-foreground hover:text-foreground"
      >
        {open ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
        Why
      </button>
      {open && (
        <ul className="mt-1 ml-3 list-disc space-y-0.5 text-[11px] text-muted-foreground">
          {suggestion.rationale.map((r, i) => (
            <li key={i}>
              {r.label}
              {r.weight != null && r.weight !== 0 && (
                <span className="ml-1 text-[10px] opacity-70">
                  ({r.weight > 0 ? "+" : ""}
                  {r.weight})
                </span>
              )}
              {r.detail && <span className="ml-1 opacity-80">— {r.detail}</span>}
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}