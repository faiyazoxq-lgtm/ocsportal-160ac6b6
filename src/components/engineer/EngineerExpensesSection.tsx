import { useState } from "react";
import { Plus, Receipt, Pencil, Sparkles } from "lucide-react";
import { toast } from "sonner";
import {
   useWorkOrderExpenses,
   useUpsertWorkOrderExpense,
   useReceiptExtraction,
} from "@/hooks/useWorkOrderExpenses";
import { ExpenseReceiptUpload } from "./ExpenseReceiptUpload";
import type { PaymentMethod } from "@/types/expenses";
import { ExpenseEditorRow } from "./ExpenseEditorRow";
import { ExpensePaymentStatusBadge } from "@/components/admin/expenses/ExpensePaymentStatusBadge";
import { EXPENSE_TYPES } from "@/hooks/useExpenses";

/**
 * Lead-engineer expenses section: add / edit / delete with receipt upload
 * + AI extraction. Support engineers see read-only list.
 */
export function EngineerExpensesSection({
  workOrderId,
  canEdit,
}: {
  workOrderId: string;
  canEdit: boolean;
}) {
  const { data: expenses = [] } = useWorkOrderExpenses(workOrderId);
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const upsert = useUpsertWorkOrderExpense();
  const extract = useReceiptExtraction();

  const onInstantReceipt = async (fileId: string) => {
    try {
      // 1. Create draft expense linked to the receipt file so the row
      //    exists immediately under Expenses (not Additional documents).
      const draftId = await upsert.mutateAsync({
        work_order_id: workOrderId,
        expense_type: "parts",
        amount: 0,
        receipt_file_id: fileId,
        payment_status: "pending",
      });
      toast.info("Reading receipt…");
      // 2. Run AI extraction and patch the row with the results.
      const res = await extract.mutateAsync({ workOrderId, fileId });
      await upsert.mutateAsync({
        id: draftId,
        work_order_id: workOrderId,
        expense_type: "parts",
        amount: res.total_amount ?? 0,
        vendor: res.vendor ?? null,
        expense_date: res.date ?? null,
        expense_time: res.time ?? null,
        receipt_number: res.receipt_number ?? null,
        payment_method: (res.payment_method ?? null) as PaymentMethod | null,
        payment_status: "pending",
        receipt_file_id: fileId,
      });
      setEditingId(draftId);
      toast.success("Receipt scanned", {
        description: `Confidence ${(res.confidence * 100).toFixed(0)}% — review and confirm`,
      });
    } catch (e) {
      toast.error("Couldn't process receipt", { description: (e as Error).message });
    }
  };

  const busy = upsert.isPending || extract.isPending;

  return (
    <section className="rounded-md border border-border bg-card p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Receipt className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold text-foreground">Expenses</h2>
        </div>
        {canEdit && !adding ? (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="inline-flex items-center gap-1 rounded-sm border border-border bg-background px-2 py-1 text-xs font-medium hover:bg-accent"
          >
            <Plus className="h-3 w-3" /> Add expense
          </button>
        ) : null}
      </div>

      {canEdit ? (
        <div className="mt-3 rounded-md border border-dashed border-primary/40 bg-primary/5 p-3">
          <div className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-foreground">
            <Sparkles className="h-3 w-3 text-primary" /> Quick add — scan a receipt
          </div>
          <p className="mb-2 text-[11px] text-muted-foreground">
            Snap or upload a receipt and we'll create the expense and fill in vendor, total,
            date and payment method automatically. The file stays attached here under Expenses.
          </p>
          <ExpenseReceiptUpload
            workOrderId={workOrderId}
            onUploaded={onInstantReceipt}
            busy={busy}
          />
          {busy ? (
            <div className="mt-2 inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <Sparkles className="h-3 w-3 animate-pulse" /> Processing receipt…
            </div>
          ) : null}
        </div>
      ) : null}

      {adding ? (
        <div className="mt-3">
          <ExpenseEditorRow
            workOrderId={workOrderId}
            canEdit={canEdit}
            onDone={() => setAdding(false)}
          />
        </div>
      ) : null}

      <ul className="mt-3 divide-y divide-border text-sm">
        {expenses.length === 0 ? (
          <li className="py-2 text-xs text-muted-foreground">No expenses yet.</li>
        ) : (
          expenses.map((e) =>
            editingId === e.id ? (
              <li key={e.id} className="py-2">
                <ExpenseEditorRow
                  workOrderId={workOrderId}
                  expense={e}
                  canEdit={canEdit}
                  canDelete={canEdit}
                  onDone={() => setEditingId(null)}
                />
              </li>
            ) : (
              <li key={e.id} className="flex items-center justify-between gap-2 py-2">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="font-medium text-foreground">
                      {e.vendor || EXPENSE_TYPES.find((t) => t.value === e.expense_type)?.label || e.expense_type}
                    </span>
                    <ExpensePaymentStatusBadge status={e.payment_status} />
                    {e.receipt_number ? (
                      <span className="text-[10px] text-muted-foreground">#{e.receipt_number}</span>
                    ) : null}
                  </div>
                  {e.note ? <div className="text-xs text-muted-foreground">{e.note}</div> : null}
                  {e.expense_date ? (
                    <div className="text-[10px] text-muted-foreground">
                      {e.expense_date}{e.expense_time ? ` ${e.expense_time}` : ""} · {e.payment_method ?? "—"}
                    </div>
                  ) : null}
                </div>
                <div className="flex items-center gap-2">
                  <div className="font-mono text-sm">£{Number(e.amount).toFixed(2)}</div>
                  {canEdit ? (
                    <button
                      type="button"
                      onClick={() => setEditingId(e.id)}
                      className="inline-flex items-center gap-1 rounded-sm border border-border bg-background px-1.5 py-0.5 text-[10px] hover:bg-muted"
                    >
                      <Pencil className="h-3 w-3" /> Edit
                    </button>
                  ) : null}
                </div>
              </li>
            ),
          )
        )}
      </ul>
    </section>
  );
}