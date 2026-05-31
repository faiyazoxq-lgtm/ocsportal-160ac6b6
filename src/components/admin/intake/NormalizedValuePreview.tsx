import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  label: string;
  from: string | null | undefined;
  to: string | null | undefined;
  warning?: string | null;
  className?: string;
}

export function NormalizedValuePreview({ label, from, to, warning, className }: Props) {
  const changed = (from ?? "") !== (to ?? "");
  return (
    <div className={cn("space-y-0.5", className)}>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="flex flex-wrap items-center gap-1.5 text-xs">
        <span className={cn("rounded-sm bg-muted px-1.5 py-0.5 font-mono", !from && "text-muted-foreground italic")}>
          {from || "—"}
        </span>
        <ArrowRight className="h-3 w-3 text-muted-foreground" />
        <span
          className={cn(
            "rounded-sm px-1.5 py-0.5 font-mono",
            changed ? "bg-primary/10 text-foreground" : "bg-muted text-muted-foreground",
            !to && "italic text-muted-foreground",
          )}
        >
          {to || "—"}
        </span>
      </div>
      {warning ? <div className="text-[10px] text-amber-600 dark:text-amber-400">{warning}</div> : null}
    </div>
  );
}