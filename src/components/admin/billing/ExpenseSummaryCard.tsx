import { useMemo } from "react";
import { useExpenses, EXPENSE_TYPES } from "@/hooks/useExpenses";

const LABEL = Object.fromEntries(EXPENSE_TYPES.map((t) => [t.value, t.label]));

export function ExpenseSummaryCard({ workOrderId }: { workOrderId: string }) {
  const { data, isLoading } = useExpenses(workOrderId);

  const totals = useMemo(() => {
    const t: Record<string, number> = {};
    let total = 0;
    for (const e of data ?? []) {
      t[e.expense_type] = (t[e.expense_type] ?? 0) + Number(e.amount ?? 0);
      total += Number(e.amount ?? 0);
    }
    return { byType: t, total, count: data?.length ?? 0 };
  }, [data]);

  return (
    <div className="rounded-sm border border-border bg-card p-3">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Expenses
        </h3>
        <span className="text-xs text-muted-foreground">{totals.count} entries</span>
      </div>
      {isLoading ? (
        <div className="h-10 animate-pulse rounded-sm bg-muted/40" />
      ) : totals.count === 0 ? (
        <p className="text-xs text-muted-foreground">No expenses submitted.</p>
      ) : (
        <div className="space-y-1 text-xs">
          {Object.entries(totals.byType).map(([k, v]) => (
            <div key={k} className="flex justify-between">
              <span className="text-muted-foreground">{LABEL[k] ?? k}</span>
              <span className="font-medium">£{v.toFixed(2)}</span>
            </div>
          ))}
          <div className="mt-2 flex justify-between border-t border-border pt-2 text-sm font-semibold">
            <span>Total</span>
            <span>£{totals.total.toFixed(2)}</span>
          </div>
        </div>
      )}
    </div>
  );
}