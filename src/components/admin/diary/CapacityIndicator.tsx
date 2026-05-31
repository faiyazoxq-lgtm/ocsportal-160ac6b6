import type { EngineerCapacity } from "@/hooks/useDiaryPlanning";

export function CapacityIndicator({ capacity }: { capacity: EngineerCapacity | undefined }) {
  if (!capacity) return null;
  const pct = Math.min(100, Math.round((capacity.scheduledMinutes / 480) * 100));
  const color =
    capacity.unavailable
      ? "bg-red-300"
      : pct > 100
        ? "bg-red-400"
        : pct > 80
          ? "bg-amber-400"
          : "bg-emerald-400";
  return (
    <div className="flex flex-col gap-0.5">
      <div className="flex items-center justify-between text-[10px] text-muted-foreground">
        <span>{capacity.jobCount} jobs · {Math.round(capacity.scheduledMinutes / 60)}h</span>
        <span>{pct}%</span>
      </div>
      <div className="h-1 w-full rounded-full bg-muted">
        <div
          className={`h-1 rounded-full ${color}`}
          style={{ width: `${Math.min(100, pct)}%` }}
        />
      </div>
    </div>
  );
}