import { useVendorExpenseTotals, type DispatcherExpenseRow } from "@/hooks/useWorkOrderExpenses";

export function VendorOutstandingSummary({ rows }: { rows: DispatcherExpenseRow[] | undefined }) {
  const totals = useVendorExpenseTotals(rows);
  const pendingGrand = totals.reduce((s, t) => s + t.pending, 0);
  const paidGrand = totals.reduce((s, t) => s + t.paid, 0);
  return (
    <div className="rounded-md border border-border bg-card p-3">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Vendor totals
        </h3>
        <div className="text-xs">
          <span className="mr-3 text-amber-700">Pending £{pendingGrand.toFixed(2)}</span>
          <span className="text-emerald-700">Paid £{paidGrand.toFixed(2)}</span>
        </div>
      </div>
      {totals.length === 0 ? (
        <p className="text-xs text-muted-foreground">No expenses yet.</p>
      ) : (
        <ul className="divide-y divide-border text-xs">
          {totals.map((t) => (
            <li key={t.vendor} className="flex items-center justify-between py-1.5">
              <span className="truncate font-medium text-foreground">{t.vendor}</span>
              <span className="flex items-center gap-3">
                <span className="text-muted-foreground">{t.count} item{t.count === 1 ? "" : "s"}</span>
                <span className="font-mono text-amber-700">£{t.pending.toFixed(2)}</span>
                <span className="font-mono text-emerald-700">£{t.paid.toFixed(2)}</span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}