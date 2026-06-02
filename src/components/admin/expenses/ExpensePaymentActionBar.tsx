import { useState } from "react";
import { toast } from "sonner";
import { CheckCircle2, Undo2, Loader2 } from "lucide-react";
import {
  useRevertExpensePending,
  type FullWorkOrderExpense,
} from "@/hooks/useWorkOrderExpenses";
import { MarkExpensePaidDialog } from "./MarkExpensePaidDialog";

/**
 * Row-level action bar for an expense: shows a primary "Mark paid" button
 * when pending, or "Revert to pending" + paid metadata when paid.
 */
export function ExpensePaymentActionBar({
  expense,
}: {
  expense: FullWorkOrderExpense;
}) {
  const [open, setOpen] = useState(false);
  const revert = useRevertExpensePending();

  if (expense.payment_status === "paid") {
    return (
      <div className="flex items-center gap-2 text-[11px]">
        <span className="inline-flex items-center gap-1 text-emerald-700">
          <CheckCircle2 className="h-3 w-3" />
          {expense.paid_at
            ? new Date(expense.paid_at).toLocaleDateString()
            : "Paid"}
          {expense.payment_reference ? ` · ${expense.payment_reference}` : ""}
        </span>
        <button
          type="button"
          onClick={() => {
            if (!confirm("Revert this payment to pending?")) return;
            revert.mutate(
              { id: expense.id, work_order_id: expense.work_order_id },
              {
                onSuccess: () => toast.success("Reverted to pending"),
                onError: (e) =>
                  toast.error("Couldn't revert", {
                    description: e instanceof Error ? e.message : "Unknown",
                  }),
              },
            );
          }}
          disabled={revert.isPending}
          className="inline-flex items-center gap-1 rounded-sm border border-border bg-background px-1.5 py-0.5 hover:bg-muted disabled:opacity-60"
        >
          {revert.isPending ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <Undo2 className="h-3 w-3" />
          )}
          Revert
        </button>
      </div>
    );
  }

  if (expense.payment_status === "not_billable") {
    return (
      <span className="text-[11px] uppercase tracking-wider text-muted-foreground">
        Not billable
      </span>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1 rounded-sm border border-emerald-300 bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-900 hover:bg-emerald-100"
      >
        <CheckCircle2 className="h-3 w-3" /> Mark paid
      </button>
      <MarkExpensePaidDialog
        expense={open ? expense : null}
        open={open}
        onOpenChange={setOpen}
      />
    </>
  );
}