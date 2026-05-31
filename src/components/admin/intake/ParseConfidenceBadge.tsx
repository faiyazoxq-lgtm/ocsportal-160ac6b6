interface Props {
  label: string;
  value: number | null | undefined;
}

export function ParseConfidenceBadge({ label, value }: Props) {
  const v = typeof value === "number" ? value : null;
  const pct = v == null ? "—" : `${Math.round(v * 100)}%`;
  const cls =
    v == null
      ? "bg-muted text-muted-foreground"
      : v >= 0.85
        ? "bg-green-100 text-green-900 dark:bg-green-900/30 dark:text-green-300"
        : v >= 0.6
          ? "bg-amber-100 text-amber-900 dark:bg-amber-900/30 dark:text-amber-200"
          : "bg-red-100 text-red-900 dark:bg-red-900/30 dark:text-red-200";
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-sm px-1.5 py-0.5 text-[10px] font-medium ${cls}`}
      title={`${label} confidence`}
    >
      <span className="uppercase tracking-wider opacity-70">{label}</span>
      <span>{pct}</span>
    </span>
  );
}