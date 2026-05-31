import type { MatchReason } from "@/lib/engineerMatching";

const TONE: Record<MatchReason["tone"], string> = {
  positive: "border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-200",
  neutral: "border-border bg-muted text-muted-foreground",
  warning: "border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-200",
};

export function MatchReasonBadge({ reason }: { reason: MatchReason }) {
  return (
    <span className={`inline-flex items-center rounded-sm border px-1.5 py-0.5 text-[10px] ${TONE[reason.tone]}`}>
      {reason.label}
    </span>
  );
}

export function NoStrongMatchWarning({ messages }: { messages: string[] }) {
  if (messages.length === 0) return null;
  return (
    <div className="rounded-sm border border-amber-300 bg-amber-50 px-2 py-1.5 text-[11px] text-amber-900 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-200">
      <div className="font-medium">Manual review suggested</div>
      <ul className="list-disc pl-4">
        {messages.map((m, i) => <li key={i}>{m}</li>)}
      </ul>
    </div>
  );
}