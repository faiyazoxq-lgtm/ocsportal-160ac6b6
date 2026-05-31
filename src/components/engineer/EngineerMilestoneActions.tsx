import { Navigation2, MapPin, PlayCircle } from "lucide-react";
import { toast } from "sonner";
import { useEngineerFieldActions, type FieldMilestone } from "@/hooks/useEngineerJobs";
import type { WorkOrderStatus } from "@/types/workOrders";

const STEPS: { m: FieldMilestone; label: string; Icon: typeof Navigation2 }[] = [
  { m: "en_route", label: "On route", Icon: Navigation2 },
  { m: "on_site", label: "Arrived", Icon: MapPin },
  { m: "field_in_progress", label: "Start work", Icon: PlayCircle },
];

export function EngineerMilestoneActions({
  workOrderId,
  currentStatus,
}: {
  workOrderId: string;
  currentStatus: WorkOrderStatus;
}) {
  const { milestone } = useEngineerFieldActions(workOrderId);

  return (
    <div className="grid grid-cols-3 gap-2">
      {STEPS.map(({ m, label, Icon }) => {
        const isCurrent = currentStatus === m;
        return (
          <button
            key={m}
            type="button"
            disabled={milestone.isPending}
            onClick={() =>
              milestone.mutate(m, {
                onSuccess: () => toast.success(label, { description: "Status updated" }),
                onError: (e) =>
                  toast.error("Update failed", {
                    description: e instanceof Error ? e.message : "Unknown error",
                  }),
              })
            }
            className={`flex flex-col items-center justify-center gap-1 rounded-md border px-2 py-3 text-xs font-medium transition-colors disabled:opacity-60 ${
              isCurrent
                ? "border-primary bg-primary/10 text-primary"
                : "border-border bg-card text-foreground hover:bg-accent/40"
            }`}
          >
            <Icon className="h-5 w-5" />
            <span>{label}</span>
          </button>
        );
      })}
    </div>
  );
}