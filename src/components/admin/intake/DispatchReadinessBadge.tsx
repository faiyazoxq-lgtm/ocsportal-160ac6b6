import { READINESS_LABEL, READINESS_TONE, type DispatchReadinessStatus } from "@/lib/dispatchReadiness";

interface Props {
  status: DispatchReadinessStatus;
  score?: number;
  compact?: boolean;
}

export function DispatchReadinessBadge({ status, score, compact }: Props) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-sm border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${READINESS_TONE[status]}`}
      title={`Dispatch readiness: ${READINESS_LABEL[status]}${typeof score === "number" ? ` · ${score}/100` : ""}`}
    >
      <span>{READINESS_LABEL[status]}</span>
      {!compact && typeof score === "number" && (
        <span className="rounded bg-background/60 px-1 text-[9px] tabular-nums">{score}</span>
      )}
    </span>
  );
}