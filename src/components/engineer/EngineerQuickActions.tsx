import { PlayCircle } from "lucide-react";
import { toast } from "sonner";
import { useQueuedMutation } from "@/hooks/useQueuedMutation";
import { useOfflineStatus } from "@/hooks/useOfflineStatus";
import type { WorkOrderStatus } from "@/types/workOrders";

/**
 * Compact, inline Start action for use on a job card.
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

  const isStarted = currentStatus === "field_in_progress";
  const label = isStarted ? "In progress" : "Start";

  return (
    <button
      type="button"
      disabled={queued.isPending || isStarted}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        queued.mutate(
          { type: "start_work", payload: { at: new Date().toISOString() } },
          {
            onSuccess: (res) =>
              res.queued
                ? toast.info(label, {
                    description: offline
                      ? "Saved offline — will sync"
                      : "Queued for retry",
                  })
                : toast.success("Work started", { description: "Status updated" }),
            onError: (err) =>
              toast.error("Update failed", {
                description:
                  err instanceof Error ? err.message : "Unknown error",
              }),
          },
        );
      }}
      className={`flex min-h-[56px] flex-1 basis-0 flex-col items-center justify-center gap-1 rounded-md border px-1 py-1.5 text-[10px] font-semibold uppercase tracking-wider transition-colors active:scale-[0.98] disabled:opacity-60 ${
        isStarted
          ? "border-primary bg-primary/10 text-primary"
          : "border-primary bg-primary text-primary-foreground hover:bg-primary/90"
      }`}
    >
      <PlayCircle className="h-5 w-5" aria-hidden />
      <span>{label}</span>
    </button>
  );
}