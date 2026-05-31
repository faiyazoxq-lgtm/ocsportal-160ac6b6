import { AlertCircle, ArrowDown } from "lucide-react";
import type { ReviewBlocker, ReviewWarning } from "@/hooks/useReviewValidation";

interface Props {
  blockers: ReviewBlocker[];
  warnings: ReviewWarning[];
  onJump?: (fieldKey: string) => void;
}

/**
 * Top-of-drawer at-a-glance summary of what blocks approval vs.
 * what is merely uncertain. Click a chip to jump to the field.
 */
export function CriticalFieldsSummary({ blockers, warnings, onJump }: Props) {
  if (blockers.length === 0 && warnings.length === 0) {
    return (
      <div className="rounded-md border border-emerald-300/70 bg-emerald-50 px-3 py-2 text-xs text-emerald-900 dark:border-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-200">
        All required fields present and confidence is acceptable. Ready for conversion.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {blockers.length > 0 && (
        <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-xs">
          <div className="mb-1.5 flex items-center gap-1.5 font-semibold text-destructive">
            <AlertCircle className="h-3.5 w-3.5" />
            Blocks conversion ({blockers.length})
          </div>
          <div className="flex flex-wrap gap-1.5">
            {blockers.map((b) => (
              <button
                key={b.key}
                type="button"
                onClick={() => onJump?.(b.key)}
                title={b.message}
                className="inline-flex items-center gap-1 rounded-sm border border-destructive/40 bg-background px-2 py-1 text-[11px] font-medium text-destructive hover:bg-destructive/10"
              >
                {b.label}
                <ArrowDown className="h-3 w-3" />
              </button>
            ))}
          </div>
        </div>
      )}
      {warnings.length > 0 && (
        <div className="rounded-md border border-amber-300/70 bg-amber-50 p-3 text-xs dark:border-amber-700 dark:bg-amber-900/15">
          <div className="mb-1.5 font-semibold text-amber-900 dark:text-amber-200">
            Warnings ({warnings.length}) — overridable but worth checking
          </div>
          <ul className="space-y-0.5 text-amber-900 dark:text-amber-200">
            {warnings.map((w) => (
              <li key={w.key} className="flex items-start gap-1.5">
                <button
                  type="button"
                  onClick={() => onJump?.(w.key)}
                  className="font-medium underline-offset-2 hover:underline"
                >
                  {w.label}:
                </button>
                <span>{w.message}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}