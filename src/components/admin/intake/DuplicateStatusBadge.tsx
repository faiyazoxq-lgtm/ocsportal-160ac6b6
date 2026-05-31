import { AlertOctagon, AlertTriangle, CheckCircle2, ShieldCheck, Link2 } from "lucide-react";
import type { DuplicateReviewStatus } from "@/types/intake";

interface Props {
  status: DuplicateReviewStatus | null | undefined;
  topScore?: number | null;
  candidateCount?: number;
  className?: string;
}

/**
 * Compact badge summarising the duplicate-review state of an intake record.
 */
export function DuplicateStatusBadge({ status, topScore, candidateCount = 0, className = "" }: Props) {
  const effective = !status || candidateCount === 0 ? (status ?? "none") : status;
  const score = topScore != null ? Math.round(topScore * 100) : null;

  const variant = (() => {
    if (effective === "confirmed" || effective === "linked")
      return {
        tone: "border-rose-300 bg-rose-50 text-rose-900 dark:border-rose-700 dark:bg-rose-900/20 dark:text-rose-200",
        Icon: Link2,
        label: effective === "linked" ? "Linked duplicate" : "Confirmed duplicate",
      };
    if (effective === "dismissed")
      return {
        tone: "border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-200",
        Icon: ShieldCheck,
        label: "Dismissed",
      };
    if (effective === "open" && candidateCount > 0) {
      const strong = (topScore ?? 0) >= 0.8;
      return {
        tone: strong
          ? "border-red-400 bg-red-50 text-red-900 dark:border-red-700 dark:bg-red-900/20 dark:text-red-200"
          : "border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-700 dark:bg-amber-900/20 dark:text-amber-200",
        Icon: strong ? AlertOctagon : AlertTriangle,
        label: strong ? "Strong duplicate" : "Possible duplicate",
      };
    }
    return {
      tone: "border-border bg-muted text-muted-foreground",
      Icon: CheckCircle2,
      label: "No duplicate",
    };
  })();

  const { tone, Icon, label } = variant;

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-sm border px-1.5 py-0.5 text-[10px] font-medium ${tone} ${className}`}
    >
      <Icon className="h-3 w-3" />
      <span>{label}</span>
      {score != null && effective === "open" && candidateCount > 0 ? (
        <span className="opacity-70">· {score}%</span>
      ) : null}
      {candidateCount > 1 ? <span className="opacity-70">· {candidateCount}</span> : null}
    </span>
  );
}