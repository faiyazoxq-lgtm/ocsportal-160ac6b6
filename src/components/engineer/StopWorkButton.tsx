import { useState } from "react";
import { toast } from "sonner";
import { StopCircle } from "lucide-react";
import { useStopWorkOrder } from "@/hooks/useStopWorkOrder";

/**
 * Reverts an in-progress job back to "on site" so the engineer can press
 * Start Work again from the jobs page. Lead-only — render the button only
 * when the caller already gates by isLead && current_status=field_in_progress.
 */
export function StopWorkButton({ workOrderId }: { workOrderId: string }) {
  const [confirming, setConfirming] = useState(false);
  const stop = useStopWorkOrder(workOrderId);

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="flex w-full items-center justify-center gap-2 rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2.5 text-sm font-semibold text-destructive hover:bg-destructive/10"
      >
        <StopCircle className="h-4 w-4" />
        Stop work
      </button>
    );
  }

  return (
    <div className="space-y-2 rounded-md border border-destructive/40 bg-destructive/5 p-3 text-xs">
      <p className="font-medium text-destructive">
        Stop work and return this job to the "Start work" state?
      </p>
      <p className="text-muted-foreground">
        Your evidence, checklist progress and expenses are kept. The job will
        show as ready to start again on your jobs list.
      </p>
      <div className="flex items-center justify-end gap-2 pt-1">
        <button
          type="button"
          onClick={() => setConfirming(false)}
          disabled={stop.isPending}
          className="rounded-sm border border-border bg-background px-3 py-1.5 text-xs font-medium hover:bg-muted"
        >
          Cancel
        </button>
        <button
          type="button"
          disabled={stop.isPending}
          onClick={() =>
            stop.mutate(undefined, {
              onSuccess: () => {
                toast.success("Work stopped", {
                  description: "Job is back to ready-to-start.",
                });
                setConfirming(false);
              },
              onError: (e) =>
                toast.error("Couldn't stop work", {
                  description: e instanceof Error ? e.message : "Unknown error",
                }),
            })
          }
          className="inline-flex items-center gap-1.5 rounded-sm bg-destructive px-3 py-1.5 text-xs font-semibold text-destructive-foreground hover:bg-destructive/90 disabled:opacity-60"
        >
          <StopCircle className="h-3.5 w-3.5" />
          {stop.isPending ? "Stopping…" : "Confirm stop work"}
        </button>
      </div>
    </div>
  );
}