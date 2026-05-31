import { useWorkOrderEvents } from "@/hooks/usePostCompletionQueue";
import { Clock } from "lucide-react";

const TYPE_DOT: Record<string, string> = {
  field_submit: "bg-primary",
  review_action: "bg-accent",
  milestone: "bg-blue-500",
  assign: "bg-violet-500",
  status_change: "bg-zinc-400",
  checklist_save: "bg-zinc-300",
  ingest: "bg-emerald-500",
};

export function JobTimelinePanel({ workOrderId }: { workOrderId: string }) {
  const { data, isLoading } = useWorkOrderEvents(workOrderId);

  if (isLoading) {
    return <div className="h-16 animate-pulse rounded-md bg-muted/40" />;
  }
  if (!data || data.length === 0) {
    return (
      <div className="text-xs text-muted-foreground">No timeline events yet.</div>
    );
  }
  return (
    <ol className="relative space-y-3 border-l border-border pl-4">
      {data.map((e) => (
        <li key={e.id} className="relative">
          <span
            className={`absolute -left-[21px] top-1.5 h-2.5 w-2.5 rounded-full ring-2 ring-card ${
              TYPE_DOT[e.event_type] ?? "bg-zinc-400"
            }`}
            aria-hidden
          />
          <div className="flex items-start justify-between gap-3">
            <div className="text-xs">
              <div className="font-medium text-foreground">
                {e.event_label || e.event_type}
              </div>
              <div className="text-[11px] uppercase tracking-wider text-muted-foreground">
                {e.event_type}
              </div>
            </div>
            <div className="shrink-0 text-[11px] text-muted-foreground inline-flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {new Date(e.created_at).toLocaleString()}
            </div>
          </div>
        </li>
      ))}
    </ol>
  );
}