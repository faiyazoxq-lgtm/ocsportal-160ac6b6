import { useState } from "react";
import { Plus, Receipt, Loader2, CloudOff } from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { EXPENSE_TYPES, useExpenses, type ExpenseType } from "@/hooks/useExpenses";
import { useOfflineStatus } from "@/hooks/useOfflineStatus";
import { useCurrentEngineer } from "@/hooks/useEngineerJobs";
import { enqueueMutation } from "@/services/offlineQueue";
import { uploadEvidence } from "@/services/evidenceUploads";

export function EngineerExpenses({
  workOrderId,
  canEdit,
}: {
  workOrderId: string;
  canEdit: boolean;
}) {
  const { data: expenses = [] } = useExpenses(workOrderId);
  const [open, setOpen] = useState(false);

  return (
    <section className="rounded-md border border-border bg-card p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Receipt className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold text-foreground">Expenses</h2>
        </div>
        {canEdit ? (
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="inline-flex items-center gap-1 rounded-sm border border-border bg-background px-2 py-1 text-xs font-medium hover:bg-accent"
          >
            <Plus className="h-3 w-3" />
            {open ? "Close" : "Add"}
          </button>
        ) : null}
      </div>
      {open && canEdit ? (
        <AddExpenseForm workOrderId={workOrderId} onDone={() => setOpen(false)} />
      ) : null}
      <ul className="mt-3 divide-y divide-border text-sm">
        {expenses.length === 0 ? (
          <li className="py-2 text-xs text-muted-foreground">No expenses yet.</li>
        ) : (
          expenses.map((e) => (
            <li key={e.id} className="flex items-center justify-between py-2">
              <div>
                <div className="font-medium text-foreground">
                  {EXPENSE_TYPES.find((t) => t.value === e.expense_type)?.label ?? e.expense_type}
                </div>
                {e.note ? <div className="text-xs text-muted-foreground">{e.note}</div> : null}
              </div>
              <div className="font-mono text-sm">£{Number(e.amount).toFixed(2)}</div>
            </li>
          ))
        )}
      </ul>
    </section>
  );
}

function AddExpenseForm({ workOrderId, onDone }: { workOrderId: string; onDone: () => void }) {
  const [expenseType, setExpenseType] = useState<ExpenseType>("parts");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [receipt, setReceipt] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const { offline } = useOfflineStatus();
  const { data: me } = useCurrentEngineer();
  const qc = useQueryClient();

  const submit = async () => {
    const n = Number(amount);
    if (!n || n <= 0) {
      toast.error("Amount required");
      return;
    }
    setBusy(true);
    try {
      let receipt_file_id: string | null = null;
      if (offline) {
        if (receipt) {
          await enqueueMutation({
            work_order_id: workOrderId,
            engineer_id: me?.id ?? null,
            type: "evidence_add",
            payload: { fileKind: "receipt_photo", mime: receipt.type },
            blob: receipt,
          });
        }
        await enqueueMutation({
          work_order_id: workOrderId,
          engineer_id: me?.id ?? null,
          type: "expense_add",
          payload: { expense_type: expenseType, amount: n, note, receipt_file_id: null },
        });
        toast.info("Saved offline");
      } else {
        if (receipt) {
          try {
            const f = await uploadEvidence({
              workOrderId,
              engineerId: me?.id ?? null,
              fileKind: "receipt_photo",
              blob: receipt,
            });
            receipt_file_id = f.id;
          } catch {
            await enqueueMutation({
              work_order_id: workOrderId,
              engineer_id: me?.id ?? null,
              type: "evidence_add",
              payload: { fileKind: "receipt_photo", mime: receipt.type },
              blob: receipt,
            });
          }
        }
        const { error } = await supabase.from("work_order_expenses").insert({
          work_order_id: workOrderId,
          expense_type: expenseType,
          amount: n,
          note: note || null,
          receipt_file_id,
          entered_by_engineer_id: me?.id ?? null,
        });
        if (error) throw error;
        toast.success("Expense added");
      }
      qc.invalidateQueries({ queryKey: ["work_order_expenses", workOrderId] });
      qc.invalidateQueries({ queryKey: ["work_order_files", workOrderId] });
      onDone();
    } catch (err) {
      toast.error("Failed", { description: err instanceof Error ? err.message : "Unknown" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-3 space-y-2 rounded-sm border border-dashed border-border bg-muted/30 p-3">
      {offline ? (
        <div className="inline-flex items-center gap-1 text-[10px] text-amber-700">
          <CloudOff className="h-3 w-3" /> Offline — will be queued
        </div>
      ) : null}
      <div className="grid grid-cols-2 gap-2">
        <select
          value={expenseType}
          onChange={(e) => setExpenseType(e.target.value as ExpenseType)}
          className="rounded-sm border border-border bg-background px-2 py-1.5 text-xs"
        >
          {EXPENSE_TYPES.map((t) => (
            <option key={t.value} value={t.value}>{t.label}</option>
          ))}
        </select>
        <input
          inputMode="decimal"
          placeholder="Amount (£)"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="rounded-sm border border-border bg-background px-2 py-1.5 text-xs"
        />
      </div>
      <textarea
        placeholder="Note (optional)"
        value={note}
        onChange={(e) => setNote(e.target.value.slice(0, 300))}
        rows={2}
        className="w-full rounded-sm border border-border bg-background px-2 py-1.5 text-xs"
      />
      <input
        type="file"
        accept="image/*"
        capture="environment"
        onChange={(e) => setReceipt(e.target.files?.[0] ?? null)}
        className="text-xs"
      />
      <button
        type="button"
        onClick={submit}
        disabled={busy}
        className="inline-flex w-full items-center justify-center gap-1 rounded-sm bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground disabled:opacity-60"
      >
        {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
        Save expense
      </button>
    </div>
  );
}