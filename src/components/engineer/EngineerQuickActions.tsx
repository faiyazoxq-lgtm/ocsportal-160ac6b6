import { Navigation2, MapPin, PlayCircle } from "lucide-react";
import { toast } from "sonner";
import { useQueuedMutation } from "@/hooks/useQueuedMutation";
import { useOfflineStatus } from "@/hooks/useOfflineStatus";
import type { WorkOrderStatus } from "@/types/workOrders";
import type { QueuedMutationType } from "@/services/offlineQueue";

const STEPS: {
  type: Extract<QueuedMutationType, "mark_on_route" | "mark_arrived" | "start_work">;
  status: WorkOrderStatus;
  label: string;
  Icon: typeof Navigation2;
}[] = [
  { type: "mark_on_route", status: "en_route", label: "On route", Icon: Navigation2 },
  { type: "mark_arrived", status: "on_site", label: "Arrived", Icon: MapPin },
  { type: "start_work", status: "field_in_progress", label: "Start", Icon: PlayCircle },
];

/**
 * Compact, inline milestone actions for use on a job card.
 * Lead-only — support engineers can view the card but should not move the
 * field status themselves (matches existing event-insert RLS policy:
 * `engineer_is_lead`).
 */
export function EngineerQuickActions({
  workOrderId,
  currentStatus,
  isLead,
}: {
  workOrderId: string;
  currentStatus: WorkOrderStatus;
  isLead: boolean;
}) {
  const queued = useQueuedMutation(workOrderId);
  const { offline } = useOfflineStatus();

  if (!isLead) return null;

  return (
    <>
      {STEPS.map(({ type, status, label, Icon }) => {
        const isCurrent = currentStatus === status;
        return (
          <button
            key={type}
            type="button"
            disabled={queued.isPending}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              queued.mutate(
                { type, payload: { at: new Date().toISOString() } },
                {
                  onSuccess: (res) =>
                    res.queued
                      ? toast.info(label, {
                          description: offline
                            ? "Saved offline — will sync"
                            : "Queued for retry",
                        })
                      : toast.success(label, { description: "Status updated" }),
                  onError: (err) =>
                    toast.error("Update failed", {
                      description:
                        err instanceof Error ? err.message : "Unknown error",
                    }),
                },
              );
            }}
            className={`inline-flex items-center gap-1 rounded-sm border px-2 py-1 text-[11px] font-medium transition-colors disabled:opacity-60 ${
              isCurrent
                ? "border-primary bg-primary/10 text-primary"
                : "border-border bg-background text-foreground hover:bg-accent/40"
            }`}
          >
            <Icon className="h-3 w-3" />
            {label}
          </button>
        );
      })}
    </>
  );
}