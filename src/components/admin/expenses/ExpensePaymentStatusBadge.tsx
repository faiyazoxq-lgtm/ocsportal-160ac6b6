import type { PaymentStatus } from "@/types/expenses";

const STYLES: Record<PaymentStatus, string> = {
  pending: "bg-amber-100 text-amber-900 border-amber-300",
  paid: "bg-emerald-100 text-emerald-900 border-emerald-300",
  not_billable: "bg-slate-200 text-slate-700 border-slate-300",
};

const LABEL: Record<PaymentStatus, string> = {
  pending: "Pending",
  paid: "Paid",
  not_billable: "Not billable",
};

export function ExpensePaymentStatusBadge({ status }: { status: PaymentStatus }) {
  return (
    <span
      className={`inline-flex items-center rounded-sm border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${STYLES[status]}`}
    >
      {LABEL[status]}
    </span>
  );
}