import { useState } from "react";
import { toast } from "sonner";
import { CheckCircle2, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  useMarkExpensePaid,
  type FullWorkOrderExpense,
} from "@/hooks/useWorkOrderExpenses";
import {
  PAYMENT_METHOD_OPTIONS,
  type PaymentMethod,
} from "@/types/expenses";

/**
 * Confirms the operator wants to mark an expense as paid and captures
 * paid-at, payment method, optional reference and note. Designed to make
 * the action obvious and reversible (revert is a separate action).
 */
export function MarkExpensePaidDialog({
  expense,
  open,
  onOpenChange,
  onPaid,
}: {
  expense: FullWorkOrderExpense | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPaid?: () => void;
}) {
  const mark = useMarkExpensePaid();
  const [method, setMethod] = useState<PaymentMethod | "">(
    (expense?.payment_method ?? "") as PaymentMethod | "",
  );
  const [reference, setReference] = useState("");
  const [note, setNote] = useState("");
  const [paidDate, setPaidDate] = useState(() =>
    new Date().toISOString().slice(0, 10),
  );

  if (!expense) return null;

  const submit = () => {
    mark.mutate(
      {
        id: expense.id,
        work_order_id: expense.work_order_id,
        payment_method: (method || null) as PaymentMethod | null,
        payment_reference: reference.trim() || null,
        paid_note: note.trim() || null,
        paid_at: new Date(paidDate + "T12:00:00").toISOString(),
      },
      {
        onSuccess: () => {
          toast.success("Marked paid", {
            description: `${expense.vendor ?? "Expense"} · £${Number(expense.amount).toFixed(2)}`,
          });
          setReference("");
          setNote("");
          onOpenChange(false);
          onPaid?.();
        },
        onError: (e) =>
          toast.error("Couldn't mark as paid", {
            description: e instanceof Error ? e.message : "Unknown error",
          }),
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <CheckCircle2 className="h-4 w-4 text-emerald-700" />
            Mark expense as paid
          </DialogTitle>
          <DialogDescription className="text-xs">
            You're recording payment of{" "}
            <span className="font-semibold text-foreground">
              £{Number(expense.amount).toFixed(2)}
            </span>{" "}
            to{" "}
            <span className="font-semibold text-foreground">
              {expense.vendor ?? "this vendor"}
            </span>
            {expense.receipt_number ? ` (receipt #${expense.receipt_number})` : ""}.
            This is reversible.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 text-xs">
          <Field label="Paid on">
            <input
              type="date"
              value={paidDate}
              onChange={(e) => setPaidDate(e.target.value)}
              className="w-full rounded-sm border border-border bg-background px-2 py-1.5"
            />
          </Field>
          <Field label="Payment method">
            <select
              value={method}
              onChange={(e) => setMethod(e.target.value as PaymentMethod | "")}
              className="w-full rounded-sm border border-border bg-background px-2 py-1.5"
            >
              <option value="">—</option>
              {PAYMENT_METHOD_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Reference (optional)">
            <input
              value={reference}
              onChange={(e) => setReference(e.target.value.slice(0, 120))}
              placeholder="e.g. bank transfer ID, last 4 of card"
              className="w-full rounded-sm border border-border bg-background px-2 py-1.5"
            />
          </Field>
          <Field label="Note (optional)">
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value.slice(0, 300))}
              rows={2}
              placeholder="Anything to capture for audit"
              className="w-full rounded-sm border border-border bg-background px-2 py-1.5"
            />
          </Field>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={submit}
            disabled={mark.isPending}
            className="gap-1.5"
          >
            {mark.isPending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <CheckCircle2 className="h-3.5 w-3.5" />
            )}
            Confirm paid
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      <div className="mt-1">{children}</div>
    </label>
  );
}