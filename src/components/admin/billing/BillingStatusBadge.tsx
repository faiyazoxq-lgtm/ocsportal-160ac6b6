import { BILLING_STATUS_LABEL, type BillingStatus } from "@/types/billing";

const STYLES: Record<BillingStatus, string> = {
  pending_review: "bg-amber-100 text-amber-900",
  ready_to_invoice: "bg-emerald-100 text-emerald-900",
  invoiced: "bg-indigo-100 text-indigo-900",
  on_hold: "bg-muted text-muted-foreground",
  rejected: "bg-red-100 text-red-900",
};

export function BillingStatusBadge({ status }: { status: BillingStatus | null }) {
  const s: BillingStatus = status ?? "pending_review";
  return (
    <span
      className={`inline-flex items-center rounded-sm px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide ${STYLES[s]}`}
    >
      {BILLING_STATUS_LABEL[s]}
    </span>
  );
}