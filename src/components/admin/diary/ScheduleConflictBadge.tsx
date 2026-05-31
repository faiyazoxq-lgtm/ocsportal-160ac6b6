import { AlertTriangle } from "lucide-react";

export function ScheduleConflictBadge({
  issues,
  size = "sm",
}: {
  issues: string[];
  size?: "sm" | "xs";
}) {
  if (!issues.length) return null;
  return (
    <span
      title={issues.join(" · ")}
      className={`inline-flex items-center gap-1 rounded-sm bg-amber-100 px-1.5 ${
        size === "xs" ? "py-0 text-[9px]" : "py-0.5 text-[10px]"
      } font-medium uppercase tracking-wide text-amber-900`}
    >
      <AlertTriangle className="h-3 w-3" />
      {issues.length === 1 ? issues[0] : `${issues.length} issues`}
    </span>
  );
}