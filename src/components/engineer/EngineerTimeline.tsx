import { History } from "lucide-react";
import type { EngineerJobDetail } from "@/hooks/useEngineerJobs";

export function EngineerTimeline({ events }: { events: EngineerJobDetail["events"] }) {
  if (!events.length) {
    return (
      <div className="rounded-sm border border-dashed border-border px-3 py-4 text-center text-xs text-muted-foreground">
        No timeline events yet.
      </div>
    );
  }
  return (
    <ol className="space-y-2">
      {events.map((e) => (
        <li
          key={e.id}
          className="flex items-start gap-2 rounded-sm border border-border bg-card px-3 py-2"
        >
          <History className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          <div className="min-w-0 flex-1">
            <div className="text-xs font-medium text-foreground">
              {e.event_label ?? e.event_type}
            </div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
              {new Date(e.created_at).toLocaleString()} · {e.event_type}
            </div>
          </div>
        </li>
      ))}
    </ol>
  );
}