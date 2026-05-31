import { Flame, ArrowUp, Minus, ArrowDown } from "lucide-react";

type Priority = "urgent" | "high" | "normal" | "low" | null | undefined;

interface Props {
  priority: Priority;
}

const META: Record<string, { label: string; tone: string; Icon: typeof Flame }> = {
  urgent: { label: "Urgent", tone: "bg-red-100 text-red-900 border-red-300 dark:bg-red-900/30 dark:text-red-200 dark:border-red-700", Icon: Flame },
  high: { label: "High", tone: "bg-orange-100 text-orange-900 border-orange-300 dark:bg-orange-900/30 dark:text-orange-200 dark:border-orange-700", Icon: ArrowUp },
  normal: { label: "Normal", tone: "bg-muted text-muted-foreground border-border", Icon: Minus },
  low: { label: "Low", tone: "bg-muted/60 text-muted-foreground border-border", Icon: ArrowDown },
};

export function QueuePriorityChip({ priority }: Props) {
  const m = META[priority ?? "normal"] ?? META.normal;
  const { Icon } = m;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-sm border px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider ${m.tone}`}
      title={`Priority: ${m.label}`}
    >
      <Icon className="h-3 w-3" />
      {m.label}
    </span>
  );
}