import type { IntakeSourceType } from "@/types/intake";
import { Mail, Webhook, Upload, PencilLine, Inbox } from "lucide-react";

const META: Record<IntakeSourceType, { label: string; tone: string; Icon: typeof Mail }> = {
  email: { label: "Email", tone: "bg-blue-100 text-blue-900 dark:bg-blue-900/30 dark:text-blue-200", Icon: Mail },
  webhook: { label: "Webhook", tone: "bg-purple-100 text-purple-900 dark:bg-purple-900/30 dark:text-purple-200", Icon: Webhook },
  upload: { label: "Upload", tone: "bg-emerald-100 text-emerald-900 dark:bg-emerald-900/30 dark:text-emerald-200", Icon: Upload },
  manual: { label: "Manual", tone: "bg-amber-100 text-amber-900 dark:bg-amber-900/30 dark:text-amber-200", Icon: PencilLine },
};

export function IntakeChannelBadge({ source }: { source: IntakeSourceType | string | null | undefined }) {
  const key = (source ?? "manual") as IntakeSourceType;
  const m = META[key] ?? { label: key || "Unknown", tone: "bg-muted text-muted-foreground", Icon: Inbox };
  const Icon = m.Icon;
  return (
    <span className={`inline-flex items-center gap-1 rounded-sm px-1.5 py-0.5 text-[10px] font-medium ${m.tone}`}>
      <Icon className="h-3 w-3" />
      {m.label}
    </span>
  );
}