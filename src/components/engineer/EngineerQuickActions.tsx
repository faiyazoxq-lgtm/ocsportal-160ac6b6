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
            className={`flex min-h-[56px] flex-1 basis-0 flex-col items-center justify-center gap-1 rounded-md border px-1 py-1.5 text-[10px] font-semibold uppercase tracking-wider transition-colors active:scale-[0.98] disabled:opacity-60 ${
              isCurrent
                ? "border-primary bg-primary/10 text-primary"
                : "border-border bg-background text-foreground hover:bg-accent/40"
            }`}
          >
            <Icon className="h-5 w-5" aria-hidden />
            <span>{label}</span>
          </button>
        );
      })}
    </>
  );
}