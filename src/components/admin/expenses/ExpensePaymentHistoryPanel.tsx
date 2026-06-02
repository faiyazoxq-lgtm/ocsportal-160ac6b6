import { History } from "lucide-react";
import { useExpensePaymentHistory } from "@/hooks/useWorkOrderExpenses";

/**
 * Recent paid expenses, newest first. Read-only panel for audit confidence.
 */
export function ExpensePaymentHistoryPanel({ limit = 25 }: { limit?: number }) {
  const { data = [], isLoading } = useExpensePaymentHistory(limit);

  return (
    <section className="overflow-hidden rounded-md border border-border bg-card">
      <header className="flex items-center justify-between bg-muted/40 px-3 py-2">
        <h3 className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          <History className="h-3.5 w-3.5" /> Recent payments
        </h3>
        <span className="text-[10px] text-muted-foreground">
          {data.length} shown
        </span>
      </header>
      {isLoading ? (
        <div className="h-16 animate-pulse bg-muted/20" />
      ) : data.length === 0 ? (
        <p className="px-3 py-4 text-center text-xs text-muted-foreground">
          No payments recorded yet.
        </p>
      ) : (
        <table className="w-full text-xs">
          <thead className="text-[10px] uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-3 py-1.5 text-left">Paid on</th>
              <th className="px-3 py-1.5 text-left">Vendor</th>
              <th className="px-3 py-1.5 text-left">Work order</th>
              <th className="px-3 py-1.5 text-left">Method</th>
              <th className="px-3 py-1.5 text-left">Reference</th>
              <th className="px-3 py-1.5 text-left">Paid by</th>
              <th className="px-3 py-1.5 text-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            {data.map((r) => (
              <tr key={r.id} className="border-t border-border">
                <td className="px-3 py-1.5 text-muted-foreground">
                  {r.paid_at ? new Date(r.paid_at).toLocaleDateString() : "—"}
                </td>
                <td className="px-3 py-1.5 font-medium">{r.vendor ?? "—"}</td>
                <td className="px-3 py-1.5 text-muted-foreground">
                  {r.work_order?.order_no ?? "—"}
                </td>
                <td className="px-3 py-1.5 text-muted-foreground">
                  {r.payment_method ?? "—"}
                </td>
                <td className="px-3 py-1.5 text-muted-foreground">
                  {r.payment_reference ?? "—"}
                </td>
                <td className="px-3 py-1.5 text-muted-foreground">
                  {r.paid_by_profile?.full_name ?? r.paid_by_profile?.email ?? "—"}
                </td>
                <td className="px-3 py-1.5 text-right font-mono">
                  £{Number(r.amount).toFixed(2)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}