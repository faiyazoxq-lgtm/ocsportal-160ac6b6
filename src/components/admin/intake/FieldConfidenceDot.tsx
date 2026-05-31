interface Props {
  fieldKey: string;
  confidence?: Record<string, number> | null;
  edited?: boolean;
}

function toneFor(v: number): string {
  if (v >= 0.85) return "bg-emerald-500";
  if (v >= 0.6) return "bg-amber-500";
  return "bg-red-500";
}

export function FieldConfidenceDot({ fieldKey, confidence, edited }: Props) {
  if (edited) {
    return (
      <span
        title="Manually edited — confidence no longer reflects parser output"
        className="ml-1 inline-flex items-center rounded-sm border border-border bg-background px-1 text-[9px] font-medium uppercase tracking-wider text-muted-foreground"
      >
        edited
      </span>
    );
  }
  const v = confidence?.[fieldKey];
  if (typeof v !== "number") return null;
  const pct = Math.round(v * 100);
  return (
    <span
      title={`Parser confidence: ${pct}%`}
      className="ml-1 inline-flex items-center gap-1 text-[10px] text-muted-foreground"
    >
      <span className={`inline-block h-1.5 w-1.5 rounded-full ${toneFor(v)}`} />
      {pct}%
    </span>
  );
}