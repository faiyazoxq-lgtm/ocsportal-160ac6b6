import { useState } from "react";
import { toast } from "sonner";
import { Save, Trash2, X, Loader2, Sparkles } from "lucide-react";
import { EXPENSE_TYPES, type ExpenseType } from "@/hooks/useExpenses";
import {
  useUpsertWorkOrderExpense,
  useDeleteWorkOrderExpense,
  useReceiptExtraction,
  type FullWorkOrderExpense,
} from "@/hooks/useWorkOrderExpenses";
import {
  PAYMENT_METHOD_OPTIONS,
  PAYMENT_STATUS_OPTIONS,
  type PaymentMethod,
  type PaymentStatus,
} from "@/types/expenses";
import { ExpenseReceiptUpload } from "./ExpenseReceiptUpload";
import { ReceiptExtractionPreview } from "./ReceiptExtractionPreview";
import { ExpensePaymentStatusBadge } from "@/components/admin/expenses/ExpensePaymentStatusBadge";

export interface ExpenseEditorRowProps {
  workOrderId: string;
  expense?: FullWorkOrderExpense;
  onDone?: () => void;
  canEdit: boolean;
  canDelete?: boolean;
}

export function ExpenseEditorRow({
  workOrderId,
  expense,
  onDone,
  canEdit,
  canDelete,
}: ExpenseEditorRowProps) {
  const [form, setForm] = useState({
    expense_type: (expense?.expense_type ?? "parts") as ExpenseType,
    amount: expense?.amount ? String(expense.amount) : "",
    vendor: expense?.vendor ?? "",
    expense_date: expense?.expense_date ?? "",
    expense_time: expense?.expense_time ?? "",
    receipt_number: expense?.receipt_number ?? "",
    payment_method: (expense?.payment_method ?? "") as PaymentMethod | "",
    payment_status: (expense?.payment_status ?? "pending") as PaymentStatus,
    note: expense?.note ?? "",
    receipt_file_id: expense?.receipt_file_id ?? null,
  });
  const [extractedText, setExtractedText] = useState(expense?.extracted_text ?? null);
  const upsert = useUpsertWorkOrderExpense();
  const del = useDeleteWorkOrderExpense(workOrderId);
  const extract = useReceiptExtraction();

  const onSave = () => {
    const amt = Number(form.amount);
    if (!amt || amt <= 0) {
      toast.error("Amount required");
      return;
    }
    upsert.mutate(
      {
        id: expense?.id,
        work_order_id: workOrderId,
        expense_type: form.expense_type,
        amount: amt,
        vendor: form.vendor || null,
        expense_date: form.expense_date || null,
        expense_time: form.expense_time || null,
        receipt_number: form.receipt_number || null,
        payment_method: (form.payment_method || null) as PaymentMethod | null,
        payment_status: form.payment_status,
        note: form.note || null,
        receipt_file_id: form.receipt_file_id,
      },
      {
        onSuccess: () => {
          toast.success(expense ? "Expense updated" : "Expense added");
          onDone?.();
        },
        onError: (e) =>
          toast.error("Save failed", { description: (e as Error).message }),
      },
    );
  };

  const onUploadComplete = async (fileId: string) => {
    setForm((p) => ({ ...p, receipt_file_id: fileId }));
    if (!expense?.id) {
      // Create the expense first so extraction can attach to it
      const amt = Number(form.amount) || 0;
      if (amt <= 0) {
        toast.info("Receipt saved. Set an amount and Save to run extraction.");
        return;
      }
    }
    toast.info("Extracting receipt details…");
    try {
      const res = await extract.mutateAsync({ workOrderId, fileId });
      setExtractedText(res.raw_text);
      setForm((p) => ({
        ...p,
        vendor: res.vendor ?? p.vendor,
        receipt_number: res.receipt_number ?? p.receipt_number,
        payment_method: (res.payment_method ?? p.payment_method) as PaymentMethod | "",
        expense_date: res.date ?? p.expense_date,
        expense_time: res.time ?? p.expense_time,
        amount: res.total_amount != null ? String(res.total_amount) : p.amount,
      }));
      toast.success("Receipt scanned", {
        description: `Confidence ${(res.confidence * 100).toFixed(0)}%`,
      });
    } catch (e) {
      toast.error("Extraction failed", { description: (e as Error).message });
    }
  };

  return (
    <div className="space-y-2 rounded-md border border-primary/30 bg-primary/5 p-3 text-xs">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        <Field label="Category">
          <select
            value={form.expense_type}
            onChange={(e) => setForm((p) => ({ ...p, expense_type: e.target.value as ExpenseType }))}
            disabled={!canEdit}
            className="w-full rounded-sm border border-border bg-background px-2 py-1.5"
          >
            {EXPENSE_TYPES.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </Field>
        <Field label="Vendor">
          <input
            value={form.vendor}
            onChange={(e) => setForm((p) => ({ ...p, vendor: e.target.value }))}
            disabled={!canEdit}
            placeholder="e.g. Screwfix"
            className="w-full rounded-sm border border-border bg-background px-2 py-1.5"
          />
        </Field>
        <Field label="Amount (£)">
          <input
            inputMode="decimal"
            value={form.amount}
            onChange={(e) => setForm((p) => ({ ...p, amount: e.target.value }))}
            disabled={!canEdit}
            className="w-full rounded-sm border border-border bg-background px-2 py-1.5"
          />
        </Field>
        <Field label="Date">
          <input
            type="date"
            value={form.expense_date}
            onChange={(e) => setForm((p) => ({ ...p, expense_date: e.target.value }))}
            disabled={!canEdit}
            className="w-full rounded-sm border border-border bg-background px-2 py-1.5"
          />
        </Field>
        <Field label="Time">
          <input
            type="time"
            value={form.expense_time}
            onChange={(e) => setForm((p) => ({ ...p, expense_time: e.target.value }))}
            disabled={!canEdit}
            className="w-full rounded-sm border border-border bg-background px-2 py-1.5"
          />
        </Field>
        <Field label="Receipt #">
          <input
            value={form.receipt_number}
            onChange={(e) => setForm((p) => ({ ...p, receipt_number: e.target.value }))}
            disabled={!canEdit}
            className="w-full rounded-sm border border-border bg-background px-2 py-1.5"
          />
        </Field>
        <Field label="Payment method">
          <select
            value={form.payment_method}
            onChange={(e) => setForm((p) => ({ ...p, payment_method: e.target.value as PaymentMethod | "" }))}
            disabled={!canEdit}
            className="w-full rounded-sm border border-border bg-background px-2 py-1.5"
          >
            <option value="">—</option>
            {PAYMENT_METHOD_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </Field>
        <Field label="Payment status">
          <select
            value={form.payment_status}
            onChange={(e) => setForm((p) => ({ ...p, payment_status: e.target.value as PaymentStatus }))}
            disabled={!canEdit}
            className="w-full rounded-sm border border-border bg-background px-2 py-1.5"
          >
            {PAYMENT_STATUS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </Field>
      </div>

      <Field label="Note">
        <textarea
          value={form.note}
          onChange={(e) => setForm((p) => ({ ...p, note: e.target.value.slice(0, 500) }))}
          disabled={!canEdit}
          rows={2}
          className="w-full rounded-sm border border-border bg-background px-2 py-1.5"
        />
      </Field>

      {canEdit ? (
        <ExpenseReceiptUpload
          workOrderId={workOrderId}
          onUploaded={onUploadComplete}
          busy={extract.isPending}
        />
      ) : null}

      {extract.isPending ? (
        <div className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <Sparkles className="h-3 w-3 animate-pulse" /> Reading receipt…
        </div>
      ) : null}

      {extractedText ? <ReceiptExtractionPreview rawText={extractedText} /> : null}

      <div className="flex items-center justify-between gap-2 pt-1">
        <div className="flex items-center gap-2">
          {expense ? (
            <ExpensePaymentStatusBadge status={form.payment_status} />
          ) : null}
        </div>
        <div className="flex items-center gap-2">
          {expense && canDelete ? (
            <button
              type="button"
              onClick={() => {
                if (!confirm("Delete this expense?")) return;
                del.mutate(expense.id, {
                  onSuccess: () => {
                    toast.success("Deleted");
                    onDone?.();
                  },
                  onError: (e) =>
                    toast.error("Delete failed", { description: (e as Error).message }),
                });
              }}
              className="inline-flex items-center gap-1 rounded-sm border border-destructive/40 bg-destructive/5 px-2 py-1 text-destructive hover:bg-destructive/10"
            >
              <Trash2 className="h-3 w-3" /> Delete
            </button>
          ) : null}
          {onDone ? (
            <button
              type="button"
              onClick={onDone}
              className="inline-flex items-center gap-1 rounded-sm border border-border bg-background px-2 py-1 hover:bg-muted"
            >
              <X className="h-3 w-3" /> Cancel
            </button>
          ) : null}
          {canEdit ? (
            <button
              type="button"
              onClick={onSave}
              disabled={upsert.isPending}
              className="inline-flex items-center gap-1 rounded-sm bg-primary px-3 py-1 font-semibold text-primary-foreground disabled:opacity-60"
            >
              {upsert.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
              {expense ? "Save" : "Add expense"}
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      {children}
    </div>
  );
}