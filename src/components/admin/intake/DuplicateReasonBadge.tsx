interface Props {
  reason: string;
}

/**
 * Chip used to surface a single duplicate match rationale, e.g.
 * "same postcode", "similar address". Visual variants come from the reason text.
 */
export function DuplicateReasonBadge({ reason }: Props) {
  const lower = reason.toLowerCase();
  const tone = lower.includes("order number")
    ? "border-rose-300 bg-rose-50 text-rose-900 dark:border-rose-700 dark:bg-rose-900/20 dark:text-rose-200"
    : lower.includes("phone")
      ? "border-red-300 bg-red-50 text-red-900 dark:border-red-700 dark:bg-red-900/20 dark:text-red-200"
      : lower.includes("address") || lower.includes("postcode")
        ? "border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-700 dark:bg-amber-900/20 dark:text-amber-200"
        : "border-border bg-muted text-muted-foreground";
  return (
    <span
      className={`inline-flex items-center rounded-sm border px-1.5 py-0.5 text-[10px] font-medium ${tone}`}
    >
      {reason}
    </span>
  );
}