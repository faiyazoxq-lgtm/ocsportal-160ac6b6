import { cn } from "@/lib/utils";
import { STRENGTH_LABEL, STRENGTH_TONE, type MatchStrength } from "@/lib/engineerMatching";

interface Props {
  strength: MatchStrength;
  score?: number;
  className?: string;
}

export function EngineerMatchBadge({ strength, score, className }: Props) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-sm border px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider",
        STRENGTH_TONE[strength],
        className,
      )}
    >
      {STRENGTH_LABEL[strength]}
      {typeof score === "number" && <span className="opacity-70">{score}</span>}
    </span>
  );
}