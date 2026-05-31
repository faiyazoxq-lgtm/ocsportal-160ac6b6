import { CheckCircle2, AlertTriangle, ShieldAlert } from "lucide-react";
import type { ReviewValidation } from "@/hooks/useReviewValidation";

interface Props {
  validation: ReviewValidation;
  overrideWarnings: boolean;
  onToggleOverride: (v: boolean) => void;
}

/**
 * Compact readiness summary shown next to the Approve & convert action.
 * Surfaces blocker/warning counts and lets the dispatcher consciously
 * acknowledge non-blocking warnings before approving.
 */
export function ReviewReadinessSummary({ validation, overrideWarnings, onToggleOverride }: Props) {
  const { blockers, warnings, editedCount, canApprove } = validation;

  const tone =
    blockers.length > 0
      ? "border-destructive/40 bg-destructive/5 text-destructive"
      : warnings.length > 0
        ? "border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-700 dark:bg-amber-900/15 dark:text-amber-200"
        : "border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-700 dark:bg-emerald-900/15 dark:text-emerald-200";

  const Icon =
    blockers.length > 0 ? ShieldAlert : warnings.length > 0 ? AlertTriangle : CheckCircle2;

  return (
    <div className={`flex flex-wrap items-center gap-3 rounded-md border px-3 py-2 text-xs ${tone}`}>
      <Icon className="h-4 w-4 shrink-0" />
      <div className="min-w-0 flex-1">
        {blockers.length > 0 ? (
          <span>
            <b>{blockers.length}</b> blocker{blockers.length === 1 ? "" : "s"} must be resolved before conversion.
          </span>
        ) : warnings.length > 0 ? (
          <span>
            No blockers. <b>{warnings.length}</b> warning{warnings.length === 1 ? "" : "s"} — review and acknowledge to approve.
          </span>
        ) : (
          <span>All required fields present. Safe to convert.</span>
        )}
        {editedCount > 0 ? (
          <span className="ml-2 opacity-80">· {editedCount} field{editedCount === 1 ? "" : "s"} manually corrected</span>
        ) : null}
      </div>
      {warnings.length > 0 && blockers.length === 0 ? (
        <label className="inline-flex shrink-0 items-center gap-1.5 font-medium">
          <input
            type="checkbox"
            checked={overrideWarnings}
            onChange={(e) => onToggleOverride(e.target.checked)}
            className="h-3.5 w-3.5"
          />
          Override warnings
        </label>
      ) : null}
      <span className="shrink-0 rounded bg-background/60 px-1.5 py-0.5 font-semibold">
        {canApprove ? "READY" : "NOT READY"}
      </span>
    </div>
  );
}