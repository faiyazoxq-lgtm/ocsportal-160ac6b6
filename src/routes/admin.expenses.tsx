import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Plus, Receipt } from "lucide-react";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { DispatcherShell } from "@/components/DispatcherShell";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { useDispatcherExpenses } from "@/hooks/useWorkOrderExpenses";
import { VendorOutstandingSummary } from "@/components/admin/expenses/VendorOutstandingSummary";
import { ExpensePaymentStatusBadge } from "@/components/admin/expenses/ExpensePaymentStatusBadge";
import { ExpenseEditorRow } from "@/components/engineer/ExpenseEditorRow";
import { EXPENSE_TYPES } from "@/hooks/useExpenses";
import type { PaymentStatus } from "@/types/expenses";

export const Route = createFileRoute("/admin/expenses")({
  head: () => ({ meta: [{ title: "Expenses · OCS" }] }),
  component: ExpensesPage,
});

function ExpensesPage() {
  const { data, isLoading } = useDispatcherExpenses();
  const [statusFilter, setStatusFilter] = useState<PaymentStatus | "all">("all");
  const [vendorFilter, setVendorFilter] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);

  const rows = useMemo(() => {
    return (data ?? []).filter((r) => {
      if (statusFilter !== "all" && r.payment_status !== statusFilter) return false;
      if (vendorFilter && !(r.vendor ?? "").toLowerCase().includes(vendorFilter.toLowerCase()))
        return false;
      return true;
    });
  }, [data, statusFilter, vendorFilter]);

  const grouped = useMemo(() => {
    const map = new Map<string, typeof rows>();
    for (const r of rows) {
      const key = r.work_order?.order_no ?? "(unlinked)";
      const arr = map.get(key) ?? [];
      arr.push(r);
      map.set(key, arr);
    }
    return Array.from(map.entries());
  }, [rows]);

  return (
    <ProtectedRoute requireRole="dispatcher">
      <DispatcherShell>
        <div className="mx-auto max-w-7xl space-y-4">
          <AdminPageHeader
            title="Expenses"
            description="Track expenses pushed from completed work orders and outstanding vendor payments."
          />

          <VendorOutstandingSummary rows={data} />

          <div className="flex flex-wrap items-center gap-2">
            {(["all", "pending", "paid", "not_billable"] as const).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setStatusFilter(s)}
                className={`rounded-sm border px-2 py-1 text-xs ${
                  statusFilter === s
                    ? "border-foreground/30 bg-accent"
                    : "border-border bg-card hover:bg-accent/40"
                }`}
              >
                {s === "all" ? "All" : s === "not_billable" ? "Not billable" : s.charAt(0).toUpperCase() + s.slice(1)}
              </button>
            ))}
            <input
              value={vendorFilter}
              onChange={(e) => setVendorFilter(e.target.value)}
              placeholder="Filter by vendor"
              className="ml-auto rounded-sm border border-border bg-background px-2 py-1 text-xs"
            />
          </div>

          {isLoading ? (
            <div className="h-32 animate-pulse rounded-sm bg-muted/40" />
          ) : grouped.length === 0 ? (
            <div className="rounded-sm border border-dashed border-border bg-card p-12 text-center text-sm text-muted-foreground">
              <Receipt className="mx-auto mb-2 h-5 w-5" />
              No expenses match.
            </div>
          ) : (
            <div className="space-y-3">
              {grouped.map(([orderNo, items]) => {
                const pushed = items[0]?.work_order?.expenses_pushed_at;
                const totalPending = items
                  .filter((i) => i.payment_status === "pending")
                  .reduce((s, i) => s + Number(i.amount), 0);
                const totalAll = items.reduce((s, i) => s + Number(i.amount), 0);
                return (
                  <section key={orderNo} className="overflow-hidden rounded-md border border-border bg-card">
                    <header className="flex items-center justify-between bg-muted/40 px-3 py-2 text-xs">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-foreground">{orderNo}</span>
                        {items[0]?.work_order?.client?.client_name ? (
                          <span className="text-muted-foreground">
                            · {items[0].work_order!.client!.client_name}
                          </span>
                        ) : null}
                        {pushed ? (
                          <span className="rounded-sm bg-emerald-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-emerald-900">
                            Pushed
                          </span>
                        ) : (
                          <span className="rounded-sm bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-amber-900">
                            Not pushed
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 text-xs">
                        <span className="text-amber-700">Pending £{totalPending.toFixed(2)}</span>
                        <span className="text-muted-foreground">Total £{totalAll.toFixed(2)}</span>
                      </div>
                    </header>
                    <table className="w-full text-xs">
                      <thead className="text-[10px] uppercase tracking-wide text-muted-foreground">
                        <tr>
                          <th className="px-3 py-1.5 text-left">Vendor</th>
                          <th className="px-3 py-1.5 text-left">Category</th>
                          <th className="px-3 py-1.5 text-left">Date</th>
                          <th className="px-3 py-1.5 text-left">Receipt #</th>
                          <th className="px-3 py-1.5 text-left">Method</th>
                          <th className="px-3 py-1.5 text-left">Status</th>
                          <th className="px-3 py-1.5 text-right">Amount</th>
                          <th></th>
                        </tr>
                      </thead>
                      <tbody>
                        {items.map((e) =>
                          editingId === e.id ? (
                            <tr key={e.id}>
                              <td colSpan={8} className="px-3 py-2">
                                <ExpenseEditorRow
                                  workOrderId={e.work_order_id}
                                  expense={e}
                                  canEdit
                                  canDelete
                                  onDone={() => setEditingId(null)}
                                />
                              </td>
                            </tr>
                          ) : (
                            <tr key={e.id} className="border-t border-border hover:bg-accent/30">
                              <td className="px-3 py-1.5 font-medium">{e.vendor ?? "—"}</td>
                              <td className="px-3 py-1.5 text-muted-foreground">
                                {EXPENSE_TYPES.find((t) => t.value === e.expense_type)?.label ?? e.expense_type}
                              </td>
                              <td className="px-3 py-1.5 text-muted-foreground">{e.expense_date ?? "—"}</td>
                              <td className="px-3 py-1.5 text-muted-foreground">{e.receipt_number ?? "—"}</td>
                              <td className="px-3 py-1.5 text-muted-foreground">{e.payment_method ?? "—"}</td>
                              <td className="px-3 py-1.5">
                                <ExpensePaymentStatusBadge status={e.payment_status} />
                              </td>
                              <td className="px-3 py-1.5 text-right font-mono">£{Number(e.amount).toFixed(2)}</td>
                              <td className="px-3 py-1.5 text-right">
                                <button
                                  type="button"
                                  onClick={() => setEditingId(e.id)}
                                  className="rounded-sm border border-border bg-background px-2 py-0.5 text-[11px] hover:bg-muted"
                                >
                                  Edit
                                </button>
                              </td>
                            </tr>
                          ),
                        )}
                      </tbody>
                    </table>
                  </section>
                );
              })}
            </div>
          )}

          <AddExpenseDialog />
        </div>
      </DispatcherShell>
    </ProtectedRoute>
  );
}

function AddExpenseDialog() {
  const [open, setOpen] = useState(false);
  const [workOrderId, setWorkOrderId] = useState("");
  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-sm border border-border bg-background px-3 py-1.5 text-xs font-medium hover:bg-muted"
      >
        <Plus className="h-3.5 w-3.5" /> Add expense manually
      </button>
    );
  }
  return (
    <div className="space-y-2 rounded-md border border-border bg-card p-3">
      <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        Work order ID
      </label>
      <input
        value={workOrderId}
        onChange={(e) => setWorkOrderId(e.target.value)}
        placeholder="Paste the work order UUID"
        className="w-full rounded-sm border border-border bg-background px-2 py-1.5 text-xs"
      />
      {workOrderId ? (
        <ExpenseEditorRow
          workOrderId={workOrderId}
          canEdit
          onDone={() => {
            setOpen(false);
            setWorkOrderId("");
          }}
        />
      ) : null}
      <button
        type="button"
        onClick={() => setOpen(false)}
        className="text-[11px] text-muted-foreground hover:underline"
      >
        Cancel
      </button>
    </div>
  );
}