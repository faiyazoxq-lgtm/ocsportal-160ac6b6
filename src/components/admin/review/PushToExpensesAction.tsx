import { Receipt, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  useWorkOrderExpenses,
  usePushWorkOrderExpenses,
} from "@/hooks/useWorkOrderExpenses";

/**
 * Dispatcher action: review expenses captured by engineers, then push to the
 * expense ledger. Until this runs (or there are no expenses), the review
 * cannot be closed — see CompletionReviewDrawer gating.
 */
export function PushToExpensesAction({
  workOrderId,
  pushedAt,
}: {
  workOrderId: string;
  pushedAt: string | null | undefined;
}) {
  const { data: expenses = [] } = useWorkOrderExpenses(workOrderId);
  const push = usePushWorkOrderExpenses(workOrderId);

  if (expenses.length === 0) {
    return (
      <p className="text-xs text-muted-foreground">
        Engineer recorded no expenses on this job.
      </p>
    );
  }

  const total = expenses.reduce((s, e) => s + Number(e.amount), 0);

  return (
    <div className="space-y-2 text-xs">
      <ul className="divide-y divide-border rounded-sm border border-border bg-background">
        {expenses.map((e) => (
          <li key={e.id} className="flex items-center justify-between px-2 py-1.5">
            <div className="min-w-0">
              <div className="truncate font-medium text-foreground">
                {e.vendor ?? e.expense_type}
              </div>
              <div className="text-[10px] text-muted-foreground">
                {e.expense_date ?? "—"} · {e.payment_method ?? "—"} · {e.payment_status}
              </div>
            </div>
            <div className="ml-2 font-mono">£{Number(e.amount).toFixed(2)}</div>
          </li>
        ))}
      </ul>
      <div className="flex items-center justify-between gap-2">
        <span className="text-muted-foreground">Total £{total.toFixed(2)}</span>
        {pushedAt ? (
          <span className="inline-flex items-center gap-1 rounded-sm bg-emerald-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-emerald-900">
            <CheckCircle2 className="h-3 w-3" /> Pushed {new Date(pushedAt).toLocaleDateString()}
          </span>
        ) : (
          <Button
            size="sm"
            onClick={() =>
              push.mutate(undefined, {
                onSuccess: () => toast.success("Expenses pushed to ledger"),
                onError: (e) =>
                  toast.error("Couldn't push expenses", {
                    description: e instanceof Error ? e.message : "Unknown error",
                  }),
              })
            }
            disabled={push.isPending}
            className="gap-1"
          >
            <Receipt className="h-3.5 w-3.5" />
            {push.isPending ? "Pushing…" : "Acknowledge & push"}
          </Button>
        )}
      </div>
    </div>
  );
}