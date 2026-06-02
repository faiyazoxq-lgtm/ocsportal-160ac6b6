import type { IntakeRecord } from "@/types/intake";
import { Layers, AlertCircle, CheckCircle2 } from "lucide-react";

interface Payload {
  work_orders_total?: number;
  ai_scanned_attachments?: number;
  gmail_message_id?: string;
}

/**
 * Strong, glanceable badge showing how many potential work orders were sniffed
 * from the inbound source (email/upload). Designed to make multi-job emails
 * obvious to Dispatcher/Boss before they open the drawer.
 */
export function PotentialWorkOrderCountBadge({
  record,
  size = "md",
}: {
  record: IntakeRecord;
  size?: "sm" | "md";
}) {
  const payload = (record.raw_payload_json ?? {}) as Payload;
  const count = derivePotentialCount(record, payload);

  const tone =
    count === 0
      ? "border-amber-500/60 bg-amber-100 text-amber-900 dark:bg-amber-900/30 dark:text-amber-100"
      : count === 1
        ? "border-emerald-500/60 bg-emerald-100 text-emerald-900 dark:bg-emerald-900/30 dark:text-emerald-100"
        : "border-indigo-500/70 bg-indigo-100 text-indigo-900 dark:bg-indigo-900/40 dark:text-indigo-100";

  const Icon = count === 0 ? AlertCircle : count > 1 ? Layers : CheckCircle2;
  const label = count === 1 ? "potential job" : "potential jobs";

  const padding = size === "sm" ? "px-1.5 py-0.5 text-[10px]" : "px-2 py-1 text-xs";
  const iconCls = size === "sm" ? "h-3 w-3" : "h-3.5 w-3.5";

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-md border font-semibold uppercase tracking-wider ${tone} ${padding}`}
      title={
        count === 0
          ? "AI did not detect a work order in this email — verify before discarding."
          : `Sniffer detected ${count} potential work order${count === 1 ? "" : "s"} from this source.`
      }
    >
      <Icon className={iconCls} />
      <span className="tabular-nums">{count}</span>
      <span className="hidden sm:inline">{label}</span>
    </span>
  );
}

function derivePotentialCount(record: IntakeRecord, payload: Payload): number {
  if (typeof payload.work_orders_total === "number" && payload.work_orders_total >= 0) {
    return payload.work_orders_total;
  }
  // Fallbacks: a converted/approved/needs_review record is itself one candidate.
  if (["converted", "approved", "needs_review", "parsed"].includes(record.parse_status)) return 1;
  return 0;
}