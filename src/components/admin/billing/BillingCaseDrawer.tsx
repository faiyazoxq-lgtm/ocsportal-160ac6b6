import { useState, useEffect } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { useWorkOrder } from "@/hooks/useWorkOrders";
import { useExpenses } from "@/hooks/useExpenses";
import { useEvidenceFiles } from "@/hooks/useEvidenceFiles";
import {
  useBillingCase,
  useBillingAdjustments,
  useBillingStatusHistory,
  useUpdateBillingStatus,
  useUpdateBillingCase,
  useAddBillingAdjustment,
  useBillingReadiness,
} from "@/hooks/useBilling";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { BillingStatusBadge } from "./BillingStatusBadge";
import { ExpenseSummaryCard } from "./ExpenseSummaryCard";
import { ReceiptList } from "./ReceiptList";
import { InvoiceReadinessChecklist } from "./InvoiceReadinessChecklist";
import { BillingReadinessSuggestion } from "@/components/admin/recommendations/BillingReadinessSuggestion";
import { BILLING_STATUS_LABEL, type BillingStatus } from "@/types/billing";
import { toast } from "sonner";

export function BillingCaseDrawer({
  workOrderId,
  onClose,
}: {
  workOrderId: string | null;
  onClose: () => void;
}) {
  const open = !!workOrderId;
  const { data: wo } = useWorkOrder(workOrderId);
  const { data: bc } = useBillingCase(workOrderId);
  const { data: expenses } = useExpenses(workOrderId);
  const { data: files } = useEvidenceFiles(workOrderId);
  const { data: adjustments } = useBillingAdjustments(bc?.id ?? null);
  const { data: history } = useBillingStatusHistory(bc?.id ?? null);
  const updateStatus = useUpdateBillingStatus();
  const updateCase = useUpdateBillingCase();
  const addAdj = useAddBillingAdjustment();

  const readiness = useBillingReadiness(
    wo ?? null,
    bc ?? null,
    expenses?.length ?? 0,
    files?.length ?? 0,
  );

  const expenseTotal =
    expenses?.reduce((s, e) => s + Number(e.amount ?? 0), 0) ?? 0;
  const receiptCount = expenses?.filter((e) => e.receipt_file_id).length ?? 0;

  const [invoiceRef, setInvoiceRef] = useState("");
  const [clientRef, setClientRef] = useState("");
  const [notes, setNotes] = useState("");
  const [billable, setBillable] = useState("");
  const [holdReason, setHoldReason] = useState("");

  useEffect(() => {
    setInvoiceRef(bc?.invoice_reference ?? "");
    setClientRef(bc?.client_reference ?? "");
    setNotes(bc?.billing_notes ?? "");
    setBillable(bc?.billable_total != null ? String(bc.billable_total) : "");
    setHoldReason(bc?.non_billable_reason ?? "");
  }, [bc?.id, bc?.invoice_reference, bc?.client_reference, bc?.billing_notes, bc?.billable_total, bc?.non_billable_reason]);

  if (!workOrderId) return null;

  const handleStatus = async (s: BillingStatus, note?: string) => {
    if (!workOrderId) return;
    await updateStatus.mutateAsync({
      workOrderId,
      toStatus: s,
      note,
      patch: {
        invoice_reference: invoiceRef || null,
        client_reference: clientRef || null,
        billing_notes: notes || null,
        billable_total: billable ? Number(billable) : null,
        expense_total: expenseTotal,
        non_billable_reason: holdReason || null,
      },
    });
    toast.success(`Marked ${BILLING_STATUS_LABEL[s]}`);
  };

  const handleSave = async () => {
    if (!workOrderId) return;
    await updateCase.mutateAsync({
      workOrderId,
      patch: {
        invoice_reference: invoiceRef || null,
        client_reference: clientRef || null,
        billing_notes: notes || null,
        billable_total: billable ? Number(billable) : null,
        expense_total: expenseTotal,
        non_billable_reason: holdReason || null,
      },
    });
    toast.success("Billing details saved");
  };

  const handleAdjustment = async () => {
    const type = prompt("Adjustment type (e.g. discount, surcharge, write-off)");
    if (!type) return;
    const amount = prompt("Amount (leave blank for note only)");
    const note = prompt("Note (optional)") ?? "";
    if (!workOrderId) return;
    await addAdj.mutateAsync({
      workOrderId,
      adjustment_type: type,
      amount: amount ? Number(amount) : null,
      note,
    });
    toast.success("Adjustment added");
  };

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-2xl">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            Billing prep
            {wo && <span className="text-sm font-normal text-muted-foreground">· {wo.order_no}</span>}
            <BillingStatusBadge status={bc?.billing_status ?? null} />
          </SheetTitle>
        </SheetHeader>

        {!wo ? (
          <div className="mt-6 h-32 animate-pulse rounded-sm bg-muted/40" />
        ) : (
          <div className="mt-4 space-y-4">
            {/* Summary */}
            <div className="rounded-sm border border-border bg-card p-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="text-sm font-semibold">{wo.job_summary}</div>
                  <div className="mt-0.5 text-xs text-muted-foreground">
                    {wo.client?.client_name} · {wo.postcode ?? "—"} · {null ?? "—"}
                  </div>
                  <div className="mt-0.5 text-xs text-muted-foreground">
                    {wo.address_line_1} {wo.city}
                  </div>
                </div>
                <StatusBadge status={wo.current_status} />
              </div>
              {wo.admin_notes && (
                <p className="mt-2 border-t border-border pt-2 text-xs text-muted-foreground">
                  <span className="font-medium text-foreground">Admin notes:</span> {wo.admin_notes}
                </p>
              )}
              {wo.review_outcome && (
                <p className="mt-1 text-xs text-muted-foreground">
                  <span className="font-medium text-foreground">Outcome:</span> {wo.review_outcome}
                </p>
              )}
            </div>

            {/* Readiness + Expenses + Receipts */}
            <BillingReadinessSuggestion
              workOrder={wo}
              billingCase={bc ?? null}
              expenseCount={expenses?.length ?? 0}
              receiptCount={receiptCount}
              evidenceCount={files?.length ?? 0}
            />
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <InvoiceReadinessChecklist items={readiness.items} />
              <ExpenseSummaryCard workOrderId={workOrderId} />
              <ReceiptList workOrderId={workOrderId} />
              <div className="rounded-sm border border-border bg-card p-3">
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Assigned engineers
                </h3>
                {(wo.assignments ?? []).length === 0 ? (
                  <p className="text-xs text-muted-foreground">Unassigned.</p>
                ) : (
                  <ul className="space-y-1 text-xs">
                    {wo.assignments?.map((a) => (
                      <li key={a.id} className="flex justify-between">
                        <span>{a.engineer?.display_name}</span>
                        <span className="text-muted-foreground">{a.assignment_role}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>

            {/* Editable billing fields */}
            <div className="rounded-sm border border-border bg-card p-3">
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Billing details
              </h3>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <Field label="Invoice reference" value={invoiceRef} onChange={setInvoiceRef} placeholder="e.g. INV-2026-0421" />
                <Field label="Client reference" value={clientRef} onChange={setClientRef} placeholder="PO / job ref" />
                <Field label="Billable total (£)" value={billable} onChange={setBillable} type="number" />
                <Field label="Expense total (£)" value={String(expenseTotal.toFixed(2))} readOnly />
                <Field label="On-hold / non-billable reason" value={holdReason} onChange={setHoldReason} placeholder="If on hold or non-billable" />
              </div>
              <label className="mt-3 block text-[11px] uppercase tracking-wide text-muted-foreground">
                Billing notes
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                  className="mt-1 w-full rounded-sm border border-border bg-background px-2 py-1.5 text-xs text-foreground"
                />
              </label>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button size="sm" variant="outline" onClick={handleSave} disabled={updateCase.isPending}>
                  Save details
                </Button>
                <Button size="sm" variant="outline" onClick={handleAdjustment}>
                  Add adjustment
                </Button>
              </div>
            </div>

            {/* Adjustments */}
            {adjustments && adjustments.length > 0 && (
              <div className="rounded-sm border border-border bg-card p-3">
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Adjustments
                </h3>
                <ul className="space-y-1 text-xs">
                  {adjustments.map((a) => (
                    <li key={a.id} className="flex justify-between">
                      <span>
                        <span className="font-medium">{a.adjustment_type}</span>
                        {a.note ? ` — ${a.note}` : ""}
                      </span>
                      <span className="text-muted-foreground">
                        {a.amount != null ? `£${Number(a.amount).toFixed(2)}` : "—"}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Status actions */}
            <div className="rounded-sm border border-border bg-card p-3">
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Status actions
              </h3>
              {!readiness.ready && (
                <p className="mb-2 rounded-sm border border-amber-200 bg-amber-50 p-2 text-xs text-amber-900">
                  Not invoice-ready: {readiness.reasons.join(", ")}
                </p>
              )}
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  onClick={() => handleStatus("ready_to_invoice")}
                  disabled={updateStatus.isPending}
                >
                  Mark ready to invoice
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleStatus("invoiced")}
                  disabled={updateStatus.isPending || !invoiceRef}
                  title={!invoiceRef ? "Add invoice reference first" : undefined}
                >
                  Mark invoiced
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleStatus("on_hold", holdReason)}
                  disabled={updateStatus.isPending}
                >
                  Place on hold
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleStatus("rejected", holdReason)}
                  disabled={updateStatus.isPending}
                >
                  Reject from billing
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => handleStatus("pending_review")}
                  disabled={updateStatus.isPending}
                >
                  Reopen
                </Button>
              </div>
            </div>

            {/* History */}
            {history && history.length > 0 && (
              <div className="rounded-sm border border-border bg-card p-3">
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Status history
                </h3>
                <ul className="space-y-1 text-xs">
                  {history.map((h) => (
                    <li key={h.id} className="flex justify-between">
                      <span>
                        {h.from_status ? `${BILLING_STATUS_LABEL[h.from_status]} → ` : ""}
                        <span className="font-medium">{BILLING_STATUS_LABEL[h.to_status]}</span>
                        {h.note ? ` — ${h.note}` : ""}
                      </span>
                      <span className="text-muted-foreground">
                        {new Date(h.created_at).toLocaleString()}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
  readOnly,
}: {
  label: string;
  value: string;
  onChange?: (v: string) => void;
  type?: string;
  placeholder?: string;
  readOnly?: boolean;
}) {
  return (
    <label className="block text-[11px] uppercase tracking-wide text-muted-foreground">
      {label}
      <input
        type={type}
        value={value}
        readOnly={readOnly}
        placeholder={placeholder}
        onChange={(e) => onChange?.(e.target.value)}
        className="mt-1 w-full rounded-sm border border-border bg-background px-2 py-1.5 text-xs text-foreground disabled:opacity-60"
      />
    </label>
  );
}