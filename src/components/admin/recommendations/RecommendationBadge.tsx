import { Lightbulb, AlertTriangle, Info } from "lucide-react";
import type { RecommendationSeverity } from "@/types/recommendations";

const STYLE: Record<RecommendationSeverity, string> = {
  info: "border-sky-200 bg-sky-50 text-sky-900 dark:border-sky-800 dark:bg-sky-900/20 dark:text-sky-200",
  suggest:
    "border-violet-200 bg-violet-50 text-violet-900 dark:border-violet-800 dark:bg-violet-900/20 dark:text-violet-200",
  warn: "border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-700 dark:bg-amber-900/20 dark:text-amber-200",
};

export function RecommendationBadge({
  severity = "suggest",
  children,
}: {
  severity?: RecommendationSeverity;
  children: React.ReactNode;
}) {
  const Icon = severity === "warn" ? AlertTriangle : severity === "info" ? Info : Lightbulb;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-sm border px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider ${STYLE[severity]}`}
    >
      <Icon className="h-3 w-3" />
      {children}
    </span>
  );
}