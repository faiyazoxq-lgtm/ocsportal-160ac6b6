import { useState } from "react";
import { Plus, Receipt, Pencil, Package } from "lucide-react";
import { useWorkOrderExpenses } from "@/hooks/useWorkOrderExpenses";
import type { ExtractedItem } from "@/types/expenses";
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

  const total = expenses.reduce((s, e) => s + Number(e.amount || 0), 0);

  return (
    <section className="rounded-md border border-border bg-card p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Receipt className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold text-foreground">Expenses</h2>
          {expenses.length ? (
            <span className="text-[11px] text-muted-foreground">
              {expenses.length} · £{total.toFixed(2)}
            </span>
          ) : null}
        </div>
        {canEdit && !adding ? (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="inline-flex items-center gap-1 rounded-sm bg-primary px-2.5 py-1 text-xs font-semibold text-primary-foreground hover:bg-primary/90"
          >
            <Plus className="h-3 w-3" /> Add expense
          </button>
        ) : null}
      </div>

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
                    {(e.extracted_items_json as ExtractedItem[] | null)?.filter((i) => i?.name)
                      .length ? (
                      <span className="inline-flex items-center gap-0.5 rounded-sm bg-primary/10 px-1 py-0.5 text-[10px] font-medium text-primary">
                        <Package className="h-2.5 w-2.5" />
                        {(e.extracted_items_json as ExtractedItem[]).filter((i) => i?.name).length} parts
                      </span>
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