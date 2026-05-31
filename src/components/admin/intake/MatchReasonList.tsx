import { cn } from "@/lib/utils";
import type { MatchReason } from "@/lib/engineerMatching";
import { Check, AlertTriangle, Minus } from "lucide-react";

interface Props {
  reasons: MatchReason[];
  blockers?: MatchReason[];
  className?: string;
}

const TONE: Record<MatchReason["tone"], string> = {
  positive: "text-emerald-700 dark:text-emerald-300",
  warning: "text-amber-700 dark:text-amber-300",
  neutral: "text-muted-foreground",
};

function Icon({ tone }: { tone: MatchReason["tone"] }) {
  if (tone === "positive") return <Check className="h-3 w-3 shrink-0" />;
  if (tone === "warning") return <AlertTriangle className="h-3 w-3 shrink-0" />;
  return <Minus className="h-3 w-3 shrink-0" />;
}

export function MatchReasonList({ reasons, blockers, className }: Props) {
  const items = [...(blockers ?? []), ...reasons];
  if (items.length === 0) return null;
  return (
    <ul className={cn("flex flex-wrap gap-x-3 gap-y-1 text-[11px]", className)}>
      {items.map((r) => (
        <li key={r.key} className={cn("inline-flex items-center gap-1", TONE[r.tone])}>
          <Icon tone={r.tone} />
          <span>{r.label}</span>
        </li>
      ))}
    </ul>
  );
}