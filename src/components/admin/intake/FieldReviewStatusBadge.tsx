import { CheckCircle2, AlertTriangle, Circle, PencilLine, XCircle } from "lucide-react";
import type { FieldStatus } from "@/hooks/useReviewValidation";

const META: Record<
  FieldStatus,
  { label: string; icon: any; cls: string; title: string }
> = {
  ok: {
    label: "reliable",
    icon: CheckCircle2,
    cls: "text-emerald-700 dark:text-emerald-300",
    title: "High parser confidence",
  },
  caution: {
    label: "verify",
    icon: AlertTriangle,
    cls: "text-amber-700 dark:text-amber-300",
    title: "Low parser confidence — verify",
  },
  missing: {
    label: "missing",
    icon: Circle,
    cls: "text-muted-foreground",
    title: "No value — fill in",
  },
  parser_failed: {
    label: "parser failed",
    icon: XCircle,
    cls: "text-destructive",
    title: "Parser could not extract this field",
  },
  edited: {
    label: "edited",
    icon: PencilLine,
    cls: "text-foreground",
    title: "Manually corrected by dispatcher",
  },
};

export function FieldReviewStatusBadge({
  status,
  confidence,
  compact = false,
}: {
  status: FieldStatus;
  confidence?: number | null;
  compact?: boolean;
}) {
  const m = META[status];
  const Icon = m.icon;
  return (
    <span
      title={m.title}
      className={`inline-flex items-center gap-1 text-[10px] uppercase tracking-wider ${m.cls}`}
    >
      <Icon className="h-3 w-3" />
      {!compact && m.label}
      {!compact && status !== "edited" && status !== "missing" && typeof confidence === "number" ? (
        <span className="font-medium tabular-nums">{Math.round(confidence * 100)}%</span>
      ) : null}
    </span>
  );
}