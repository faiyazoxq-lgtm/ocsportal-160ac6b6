import { ShieldAlert, AlertTriangle, CheckCircle2 } from "lucide-react";
import { DispatchReadinessBadge } from "./DispatchReadinessBadge";
import type { DispatchReadiness } from "@/lib/dispatchReadiness";

interface Props {
  readiness: DispatchReadiness;
  onJump?: (key: string) => void;
}

/**
 * Richer readiness panel for the review drawer.
 * Shows the dispatch-readiness status, score, and a concise list of
 * blockers (must-fix) vs warnings (overridable) with the original
 * "why it's not ready" reasoning preserved.
 */
export function ReadinessSummaryPanel({ readiness, onJump }: Props) {
  const { status, score, blockers, warnings, readyForConversion } = readiness;

  return (
    <section className="rounded-md border border-border bg-card">
      <div className="flex flex-wrap items-center gap-2 border-b border-border px-3 py-2">
        <div className="text-[11px] uppercase tracking-wider text-muted-foreground">
          Dispatch readiness
        </div>
        <DispatchReadinessBadge status={status} score={score} />
        <div className="ml-auto text-[11px] text-muted-foreground">
          {readyForConversion ? "Safe to convert" : "Not yet ready for conversion"}
        </div>
      </div>

      <div className="grid gap-3 p-3 md:grid-cols-2">
        <div>
          <div className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-destructive">
            <ShieldAlert className="h-3.5 w-3.5" />
            Blockers · {blockers.length}
          </div>
          {blockers.length === 0 ? (
            <div className="flex items-center gap-1.5 text-xs text-emerald-700 dark:text-emerald-300">
              <CheckCircle2 className="h-3.5 w-3.5" /> No blockers
            </div>
          ) : (
            <ul className="space-y-1 text-xs">
              {blockers.map((b) => (
                <li key={b.key} className="flex items-start gap-2">
                  <span className="mt-0.5 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-destructive" />
                  <div className="flex-1">
                    <span className="font-medium text-foreground">{b.label}:</span>{" "}
                    <span className="text-muted-foreground">{b.message}</span>
                  </div>
                  {onJump && (
                    <button
                      onClick={() => onJump(b.key)}
                      className="text-[10px] uppercase tracking-wider text-primary hover:underline"
                    >
                      Fix
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div>
          <div className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-amber-700 dark:text-amber-300">
            <AlertTriangle className="h-3.5 w-3.5" />
            Warnings · {warnings.length}
          </div>
          {warnings.length === 0 ? (
            <div className="text-xs text-muted-foreground">No warnings</div>
          ) : (
            <ul className="space-y-1 text-xs">
              {warnings.map((w) => (
                <li key={w.key} className="flex items-start gap-2">
                  <span className="mt-0.5 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" />
                  <div className="flex-1">
                    <span className="font-medium text-foreground">{w.label}:</span>{" "}
                    <span className="text-muted-foreground">{w.message}</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}