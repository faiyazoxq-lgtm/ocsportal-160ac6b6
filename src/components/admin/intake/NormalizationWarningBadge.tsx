import { AlertTriangle, Info } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  count: number;
  severity?: "info" | "warn";
  className?: string;
}

export function NormalizationWarningBadge({ count, severity = "warn", className }: Props) {
  if (!count) return null;
  const Icon = severity === "warn" ? AlertTriangle : Info;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-sm border px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider",
        severity === "warn"
          ? "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300"
          : "border-border bg-muted text-muted-foreground",
        className,
      )}
    >
      <Icon className="h-3 w-3" />
      {count} {severity === "warn" ? "warning" : "note"}
      {count > 1 ? "s" : ""}
    </span>
  );
}