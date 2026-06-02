import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Save, Trash2, X, Loader2, Sparkles, Eye, EyeOff, ChevronDown } from "lucide-react";
import { EXPENSE_TYPES, type ExpenseType } from "@/hooks/useExpenses";
import {
  useUpsertWorkOrderExpense,
  useDeleteWorkOrderExpense,
  useReceiptExtraction,
  useKnownExpenseVendors,
  type FullWorkOrderExpense,
} from "@/hooks/useWorkOrderExpenses";
import { useEvidenceFiles, useSignedUrl } from "@/hooks/useEvidenceFiles";
import {
  PAYMENT_METHOD_OPTIONS,
  PAYMENT_STATUS_OPTIONS,
  type PaymentMethod,
  type PaymentStatus,
  type ExtractedItem,
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
  const [extractedItems, setExtractedItems] = useState<ExtractedItem[]>(
    (expense?.extracted_items_json as ExtractedItem[] | undefined) ?? [],
  );
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showReceipt, setShowReceipt] = useState(false);
  const upsert = useUpsertWorkOrderExpense();
  const del = useDeleteWorkOrderExpense(workOrderId);
  const extract = useReceiptExtraction();
  const { data: knownVendors = [] } = useKnownExpenseVendors();
  const { data: files = [] } = useEvidenceFiles(workOrderId);
  const receiptFile = useMemo(
    () => files.find((f) => f.id === form.receipt_file_id) ?? null,
    [files, form.receipt_file_id],
  );
  const { data: receiptUrl } = useSignedUrl(
    showReceipt ? receiptFile?.storage_bucket ?? null : null,
    showReceipt ? receiptFile?.storage_path ?? null : null,
    600,
  );

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
    toast.info("Extracting receipt details…");
    try {
      const res = await extract.mutateAsync({ workOrderId, fileId });
      setExtractedText(res.raw_text);
      setExtractedItems(res.items ?? []);
      // Only fill empty fields — never silently overwrite the engineer's
      // own input. Confidence is shown so they can sanity-check.
      setForm((p) => ({
        ...p,
        vendor: p.vendor.trim() ? p.vendor : (res.vendor ?? ""),
        receipt_number: p.receipt_number || (res.receipt_number ?? ""),
        payment_method: (p.payment_method || (res.payment_method ?? "")) as PaymentMethod | "",
        expense_date: p.expense_date || (res.date ?? ""),
        expense_time: p.expense_time || (res.time ?? ""),
        amount:
          p.amount && Number(p.amount) > 0
            ? p.amount
            : res.total_amount != null
              ? String(res.total_amount)
              : p.amount,
        // Suggest an item description from the first extracted item if engineer hasn't typed one.
        note:
          p.note?.trim()
            ? p.note
            : (res.items ?? []).find((i) => i?.name)?.name ?? p.note,
      }));
      const conf = Math.round((res.confidence ?? 0) * 100);
      if (!res.vendor && res.total_amount == null) {
        toast.error("Couldn't read this receipt", {
          description: "Edit the fields manually — the file is saved.",
        });
      } else {
        toast.success(`Receipt scanned · ${conf}% confidence`, {
          description: "Empty fields filled. Review before saving.",
        });
      }
    } catch (e) {
      toast.error("Extraction failed", { description: (e as Error).message });
    }
  };

  return (
    <div className="space-y-3 rounded-md border border-primary/30 bg-primary/5 p-3 text-xs">
      {/* Core fields — most important first, mobile-friendly */}
      <div className="grid grid-cols-2 gap-2">
        <Field label="Type">
          <select
            value={form.expense_type}
            onChange={(e) => setForm((p) => ({ ...p, expense_type: e.target.value as ExpenseType }))}
            disabled={!canEdit}
            className="h-9 w-full rounded-sm border border-border bg-background px-2"
          >
            {EXPENSE_TYPES.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </Field>
        <Field label="Amount (£)">
          <input
            inputMode="decimal"
            placeholder="0.00"
            value={form.amount}
            onChange={(e) => setForm((p) => ({ ...p, amount: e.target.value }))}
            disabled={!canEdit}
            className="h-9 w-full rounded-sm border border-border bg-background px-2 text-right font-mono text-sm"
          />
        </Field>
      </div>

      <Field label="Merchant">
        <input
          list="expense-vendor-options"
          value={form.vendor}
          onChange={(e) => setForm((p) => ({ ...p, vendor: e.target.value }))}
          disabled={!canEdit}
          placeholder="Pick or type a new merchant (e.g. Screwfix)"
          className="h-9 w-full rounded-sm border border-border bg-background px-2"
        />
        {knownVendors.length ? (
          <datalist id="expense-vendor-options">
            {knownVendors.map((v) => (
              <option key={v} value={v} />
            ))}
          </datalist>
        ) : null}
      </Field>

      <Field label="Part / item">
        <input
          value={form.note}
          onChange={(e) => setForm((p) => ({ ...p, note: e.target.value.slice(0, 500) }))}
          disabled={!canEdit}
          placeholder="What did you buy? (e.g. 22mm copper elbow x2)"
          className="h-9 w-full rounded-sm border border-border bg-background px-2"
        />
      </Field>

      {/* Receipt — upload button only; preview on demand */}
      {canEdit ? (
        <div className="rounded-sm border border-dashed border-border bg-background/60 p-2">
          <ExpenseReceiptUpload
            workOrderId={workOrderId}
            onUploaded={onUploadComplete}
            busy={extract.isPending}
          />
          {form.receipt_file_id ? (
            <div className="mt-2 flex items-center justify-between gap-2">
              <span className="inline-flex items-center gap-1 text-[11px] text-emerald-700">
                <Sparkles className="h-3 w-3" /> Receipt attached
              </span>
              <button
                type="button"
                onClick={() => setShowReceipt((v) => !v)}
                className="inline-flex items-center gap-1 rounded-sm border border-border bg-background px-2 py-0.5 text-[11px] hover:bg-muted"
              >
                {showReceipt ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                {showReceipt ? "Hide receipt" : "View receipt"}
              </button>
            </div>
          ) : null}
          {showReceipt && receiptFile ? (
            <div className="mt-2 overflow-hidden rounded-sm border border-border bg-background">
              {receiptUrl ? (
                receiptFile.mime_type?.startsWith("image/") ? (
                  <img src={receiptUrl} alt="Receipt" className="max-h-72 w-full object-contain" />
                ) : (
                  <a
                    href={receiptUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block p-3 text-center text-[11px] font-medium text-primary underline"
                  >
                    Open attached receipt in new tab
                  </a>
                )
              ) : (
                <div className="p-2 text-[11px] text-muted-foreground">Loading…</div>
              )}
            </div>
          ) : null}
        </div>
      ) : null}

      {extract.isPending ? (
        <div className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <Sparkles className="h-3 w-3 animate-pulse" /> Reading receipt…
        </div>
      ) : null}

      {/* Advanced fields — progressive disclosure */}
      <button
        type="button"
        onClick={() => setShowAdvanced((v) => !v)}
        className="inline-flex items-center gap-1 text-[11px] font-medium text-muted-foreground hover:text-foreground"
      >
        <ChevronDown className={`h-3 w-3 transition-transform ${showAdvanced ? "rotate-180" : ""}`} />
        {showAdvanced ? "Hide details" : "More details (date, payment, receipt #)"}
      </button>

      {showAdvanced ? (
        <div className="grid grid-cols-2 gap-2 rounded-sm border border-border bg-background/40 p-2 sm:grid-cols-3">
          <Field label="Date">
            <input
              type="date"
              value={form.expense_date}
              onChange={(e) => setForm((p) => ({ ...p, expense_date: e.target.value }))}
              disabled={!canEdit}
              className="h-9 w-full rounded-sm border border-border bg-background px-2"
            />
          </Field>
          <Field label="Time">
            <input
              type="time"
              value={form.expense_time}
              onChange={(e) => setForm((p) => ({ ...p, expense_time: e.target.value }))}
              disabled={!canEdit}
              className="h-9 w-full rounded-sm border border-border bg-background px-2"
            />
          </Field>
          <Field label="Receipt #">
            <input
              value={form.receipt_number}
              onChange={(e) => setForm((p) => ({ ...p, receipt_number: e.target.value }))}
              disabled={!canEdit}
              className="h-9 w-full rounded-sm border border-border bg-background px-2"
            />
          </Field>
          <Field label="Payment method">
            <select
              value={form.payment_method}
              onChange={(e) => setForm((p) => ({ ...p, payment_method: e.target.value as PaymentMethod | "" }))}
              disabled={!canEdit}
              className="h-9 w-full rounded-sm border border-border bg-background px-2"
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
              className="h-9 w-full rounded-sm border border-border bg-background px-2"
            >
              {PAYMENT_STATUS_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </Field>
        </div>
      ) : null}

      {extractedText || extractedItems.length > 0 ? (
        <details className="rounded-sm border border-border bg-background/40">
          <summary className="cursor-pointer px-2 py-1.5 text-[11px] font-medium text-muted-foreground">
            Extracted receipt details
          </summary>
          <div className="p-2">
            <ReceiptExtractionPreview rawText={extractedText ?? ""} items={extractedItems} />
          </div>
        </details>
      ) : null}

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