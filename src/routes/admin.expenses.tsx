import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Plus, Receipt } from "lucide-react";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { DispatcherShell } from "@/components/DispatcherShell";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { useDispatcherExpenses } from "@/hooks/useWorkOrderExpenses";
import { VendorOutstandingSummary } from "@/components/admin/expenses/VendorOutstandingSummary";
import { ExpensePaymentStatusBadge } from "@/components/admin/expenses/ExpensePaymentStatusBadge";
import { ExpensePaymentActionBar } from "@/components/admin/expenses/ExpensePaymentActionBar";
import { ExpensePaymentHistoryPanel } from "@/components/admin/expenses/ExpensePaymentHistoryPanel";
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
  const [orderFilter, setOrderFilter] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [groupBy, setGroupBy] = useState<"order" | "vendor">("order");
  const [editingId, setEditingId] = useState<string | null>(null);

  const rows = useMemo(() => {
    return (data ?? []).filter((r) => {
      if (statusFilter !== "all" && r.payment_status !== statusFilter) return false;
      if (vendorFilter && !(r.vendor ?? "").toLowerCase().includes(vendorFilter.toLowerCase()))
        return false;
      if (
        orderFilter &&
        !(r.work_order?.order_no ?? "").toLowerCase().includes(orderFilter.toLowerCase())
      )
        return false;
      const d = r.expense_date ?? r.created_at.slice(0, 10);
      if (fromDate && d < fromDate) return false;
      if (toDate && d > toDate) return false;
      return true;
    });
  }, [data, statusFilter, vendorFilter, orderFilter, fromDate, toDate]);

  const grouped = useMemo(() => {
    const map = new Map<string, typeof rows>();
    for (const r of rows) {
      const key =
        groupBy === "order"
          ? (r.work_order?.order_no ?? "(unlinked)")
          : (r.vendor ?? "(unspecified vendor)");
      const arr = map.get(key) ?? [];
      arr.push(r);
      map.set(key, arr);
    }
    return Array.from(map.entries());
  }, [rows, groupBy]);

  const clearFilters = () => {
    setStatusFilter("all");
    setVendorFilter("");
    setOrderFilter("");
    setFromDate("");
    setToDate("");
  };
  const hasFilters =
    statusFilter !== "all" || vendorFilter || orderFilter || fromDate || toDate;

  return (
    <ProtectedRoute requireRole="dispatcher">
      <DispatcherShell>
        <div className="mx-auto max-w-7xl space-y-4">
          <AdminPageHeader
            title="Expenses"
            description="Track expenses pushed from completed work orders and outstanding vendor payments."
          />

          <VendorOutstandingSummary rows={data} />

          <ExpenseStatusFilterBar
            statusFilter={statusFilter}
            setStatusFilter={setStatusFilter}
            vendorFilter={vendorFilter}
            setVendorFilter={setVendorFilter}
            orderFilter={orderFilter}
            setOrderFilter={setOrderFilter}
            fromDate={fromDate}
            setFromDate={setFromDate}
            toDate={toDate}
            setToDate={setToDate}
            groupBy={groupBy}
            setGroupBy={setGroupBy}
            hasFilters={!!hasFilters}
            onClear={clearFilters}
            counts={{
              all: data?.length ?? 0,
              pending: data?.filter((d) => d.payment_status === "pending").length ?? 0,
              paid: data?.filter((d) => d.payment_status === "paid").length ?? 0,
              not_billable: data?.filter((d) => d.payment_status === "not_billable").length ?? 0,
            }}
          />

          {isLoading ? (
            <div className="h-32 animate-pulse rounded-sm bg-muted/40" />
          ) : grouped.length === 0 ? (
            <div className="rounded-sm border border-dashed border-border bg-card p-12 text-center text-sm text-muted-foreground">
              <Receipt className="mx-auto mb-2 h-5 w-5" />
              No expenses match.
            </div>
          ) : (
            <div className="space-y-3">
              {grouped.map(([groupKey, items]) => {
                const pushed = items[0]?.work_order?.expenses_pushed_at;
                const totalPending = items
                  .filter((i) => i.payment_status === "pending")
                  .reduce((s, i) => s + Number(i.amount), 0);
                const totalPaid = items
                  .filter((i) => i.payment_status === "paid")
                  .reduce((s, i) => s + Number(i.amount), 0);
                const totalAll = items.reduce((s, i) => s + Number(i.amount), 0);
                return (
                  <section key={groupKey} className="overflow-hidden rounded-md border border-border bg-card">
                    <header className="flex items-center justify-between bg-muted/40 px-3 py-2 text-xs">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-foreground">{groupKey}</span>
                        {groupBy === "order" && items[0]?.work_order?.client?.client_name ? (
                          <span className="text-muted-foreground">
                            · {items[0].work_order!.client!.client_name}
                          </span>
                        ) : null}
                        {groupBy === "order" && pushed ? (
                          <span className="rounded-sm bg-emerald-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-emerald-900">
                            Pushed
                          </span>
                        ) : groupBy === "order" ? (
                          <span className="rounded-sm bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-amber-900">
                            Not pushed
                          </span>
                        ) : null}
                      </div>
                      <div className="flex items-center gap-3 text-xs">
                        <span className="text-amber-700">Pending £{totalPending.toFixed(2)}</span>
                        <span className="text-emerald-700">Paid £{totalPaid.toFixed(2)}</span>
                        <span className="text-muted-foreground">Total £{totalAll.toFixed(2)}</span>
                      </div>
                    </header>
                    <table className="w-full text-xs">
                      <thead className="text-[10px] uppercase tracking-wide text-muted-foreground">
                        <tr>
                          <th className="px-3 py-1.5 text-left">
                            {groupBy === "order" ? "Vendor" : "Work order"}
                          </th>
                          <th className="px-3 py-1.5 text-left">Category</th>
                          <th className="px-3 py-1.5 text-left">Date</th>
                          <th className="px-3 py-1.5 text-left">Receipt #</th>
                          <th className="px-3 py-1.5 text-left">Method</th>
                          <th className="px-3 py-1.5 text-left">Status</th>
                          <th className="px-3 py-1.5 text-right">Amount</th>
                          <th className="px-3 py-1.5 text-right">Payment</th>
                          <th></th>
                        </tr>
                      </thead>
                      <tbody>
                        {items.map((e) =>
                          editingId === e.id ? (
                            <tr key={e.id}>
                              <td colSpan={9} className="px-3 py-2">
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
                              <td className="px-3 py-1.5 font-medium">
                                {groupBy === "order"
                                  ? (e.vendor ?? "—")
                                  : (e.work_order?.order_no ?? "—")}
                              </td>
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
                                <ExpensePaymentActionBar expense={e} />
                              </td>
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

          <ExpensePaymentHistoryPanel />
        </div>
      </DispatcherShell>
    </ProtectedRoute>
  );
}

function ExpenseStatusFilterBar({
  statusFilter,
  setStatusFilter,
  vendorFilter,
  setVendorFilter,
  orderFilter,
  setOrderFilter,
  fromDate,
  setFromDate,
  toDate,
  setToDate,
  groupBy,
  setGroupBy,
  hasFilters,
  onClear,
  counts,
}: {
  statusFilter: PaymentStatus | "all";
  setStatusFilter: (s: PaymentStatus | "all") => void;
  vendorFilter: string;
  setVendorFilter: (s: string) => void;
  orderFilter: string;
  setOrderFilter: (s: string) => void;
  fromDate: string;
  setFromDate: (s: string) => void;
  toDate: string;
  setToDate: (s: string) => void;
  groupBy: "order" | "vendor";
  setGroupBy: (g: "order" | "vendor") => void;
  hasFilters: boolean;
  onClear: () => void;
  counts: { all: number; pending: number; paid: number; not_billable: number };
}) {
  const statusOpts: { value: PaymentStatus | "all"; label: string; tone?: string }[] = [
    { value: "all", label: `All (${counts.all})` },
    { value: "pending", label: `Pending (${counts.pending})`, tone: "amber" },
    { value: "paid", label: `Paid (${counts.paid})`, tone: "emerald" },
    { value: "not_billable", label: `Not billable (${counts.not_billable})` },
  ];
  return (
    <div className="space-y-2 rounded-md border border-border bg-card p-2">
      <div className="flex flex-wrap items-center gap-2">
        {statusOpts.map((s) => {
          const active = statusFilter === s.value;
          const toneActive =
            s.tone === "amber"
              ? "border-amber-300 bg-amber-50 text-amber-900"
              : s.tone === "emerald"
                ? "border-emerald-300 bg-emerald-50 text-emerald-900"
                : "border-foreground/30 bg-accent";
          return (
            <button
              key={s.value}
              type="button"
              onClick={() => setStatusFilter(s.value)}
              className={`rounded-sm border px-2 py-1 text-xs font-medium ${
                active ? toneActive : "border-border bg-background hover:bg-accent/40"
              }`}
            >
              {s.label}
            </button>
          );
        })}
        <span className="ml-2 inline-flex items-center gap-1 text-[11px] text-muted-foreground">
          Group by
        </span>
        <div className="inline-flex overflow-hidden rounded-sm border border-border">
          {(["order", "vendor"] as const).map((g) => (
            <button
              key={g}
              type="button"
              onClick={() => setGroupBy(g)}
              className={`px-2 py-1 text-[11px] ${
                groupBy === g ? "bg-accent" : "bg-background hover:bg-accent/40"
              }`}
            >
              {g === "order" ? "Work order" : "Vendor"}
            </button>
          ))}
        </div>
        {hasFilters ? (
          <button
            type="button"
            onClick={onClear}
            className="ml-auto rounded-sm border border-border bg-background px-2 py-1 text-[11px] hover:bg-muted"
          >
            Clear filters
          </button>
        ) : null}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <input
          value={vendorFilter}
          onChange={(e) => setVendorFilter(e.target.value)}
          placeholder="Vendor"
          className="w-40 rounded-sm border border-border bg-background px-2 py-1 text-xs"
        />
        <input
          value={orderFilter}
          onChange={(e) => setOrderFilter(e.target.value)}
          placeholder="Work order #"
          className="w-40 rounded-sm border border-border bg-background px-2 py-1 text-xs"
        />
        <label className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
          From
          <input
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            className="rounded-sm border border-border bg-background px-1.5 py-1 text-xs"
          />
        </label>
        <label className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
          To
          <input
            type="date"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            className="rounded-sm border border-border bg-background px-1.5 py-1 text-xs"
          />
        </label>
      </div>
    </div>
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