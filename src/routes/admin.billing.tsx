import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { DispatcherShell } from "@/components/DispatcherShell";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { BillingStatusBadge } from "@/components/admin/billing/BillingStatusBadge";
import { BillingFiltersBar } from "@/components/admin/billing/BillingFiltersBar";
import { BillingCaseDrawer } from "@/components/admin/billing/BillingCaseDrawer";
import {
  useBillingQueue,
  useBillingExport,
  type BillingQueueFilters,
} from "@/hooks/useBilling";
import { BILLING_STATUSES, BILLING_STATUS_LABEL, type BillingStatus } from "@/types/billing";
import { Download } from "lucide-react";

export const Route = createFileRoute("/admin/billing")({
  head: () => ({ meta: [{ title: "Billing Prep · OCS" }] }),
  component: BillingPage,
});

function BillingPage() {
  const [filters, setFilters] = useState<BillingQueueFilters>({});
  const [selected, setSelected] = useState<string | null>(null);
  const { data, isLoading, error } = useBillingQueue(filters);
  const exportCsv = useBillingExport();

  const counts = useMemo(() => {
    const c: Record<BillingStatus, number> = {
      pending_review: 0,
      ready_to_invoice: 0,
      invoiced: 0,
      on_hold: 0,
      rejected: 0,
    };
    for (const r of data ?? []) {
      const s = r.billing_case?.billing_status ?? "pending_review";
      c[s] = (c[s] ?? 0) + 1;
    }
    return c;
  }, [data]);

  return (
    <ProtectedRoute requireRole="dispatcher">
      <DispatcherShell>
        <div className="mx-auto max-w-7xl">
          <AdminPageHeader
            title="Billing Prep"
            description="Review completed jobs and prepare them for invoicing."
            actions={
              <Button
                size="sm"
                variant="outline"
                onClick={() => data && exportCsv.mutate(data)}
                disabled={!data || data.length === 0}
              >
                <Download className="mr-1.5 h-3.5 w-3.5" />
                Export CSV
              </Button>
            }
          />

          {/* Status counts */}
          <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-5">
            {BILLING_STATUSES.map((s) => {
              const isActive = (filters.status ?? "all") === s;
              return (
                <button
                  key={s}
                  type="button"
                  onClick={() =>
                    setFilters((f) => ({ ...f, status: isActive ? "all" : s }))
                  }
                  className={`rounded-sm border px-3 py-2 text-left transition-colors ${
                    isActive
                      ? "border-foreground/30 bg-accent"
                      : "border-border bg-card hover:bg-accent/40"
                  }`}
                >
                  <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                    {BILLING_STATUS_LABEL[s]}
                  </div>
                  <div className="text-lg font-semibold text-foreground">
                    {counts[s] ?? 0}
                  </div>
                </button>
              );
            })}
          </div>

          <BillingFiltersBar filters={filters} onChange={setFilters} />

          {isLoading ? (
            <div className="h-32 animate-pulse rounded-sm bg-muted/40" />
          ) : error ? (
            <div className="rounded-sm border border-red-200 bg-red-50 p-4 text-sm text-red-900">
              Couldn't load billing queue.
            </div>
          ) : !data || data.length === 0 ? (
            <div className="rounded-sm border border-dashed border-border bg-card px-4 py-12 text-center text-sm text-muted-foreground">
              No jobs match the current filters.
            </div>
          ) : (
            <div className="overflow-hidden rounded-sm border border-border bg-card">
              <table className="w-full text-xs">
                <thead className="bg-muted/40 text-[10px] uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 text-left">Order</th>
                    <th className="px-3 py-2 text-left">Client</th>
                    <th className="px-3 py-2 text-left">Trade / Zone</th>
                    <th className="px-3 py-2 text-left">Job status</th>
                    <th className="px-3 py-2 text-left">Billing</th>
                    <th className="px-3 py-2 text-right">Billable £</th>
                    <th className="px-3 py-2 text-left">Invoice ref</th>
                    <th className="px-3 py-2 text-left">Updated</th>
                    <th className="px-3 py-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {data.map((r) => (
                    <tr key={r.work_order.id} className="border-t border-border hover:bg-accent/30">
                      <td className="px-3 py-2 font-medium">{r.work_order.order_no}</td>
                      <td className="px-3 py-2">{r.work_order.client?.client_name ?? "—"}</td>
                      <td className="px-3 py-2 text-muted-foreground">
                        {r.work_order.primary_trade ?? "—"} · {r.work_order.postcode_zone ?? "—"}
                      </td>
                      <td className="px-3 py-2">
                        <StatusBadge status={r.work_order.current_status} />
                      </td>
                      <td className="px-3 py-2">
                        <BillingStatusBadge status={r.billing_case?.billing_status ?? null} />
                      </td>
                      <td className="px-3 py-2 text-right">
                        {r.billing_case?.billable_total != null
                          ? `£${Number(r.billing_case.billable_total).toFixed(2)}`
                          : "—"}
                      </td>
                      <td className="px-3 py-2 text-muted-foreground">
                        {r.billing_case?.invoice_reference ?? "—"}
                      </td>
                      <td className="px-3 py-2 text-muted-foreground">
                        {new Date(r.work_order.updated_at).toLocaleDateString()}
                      </td>
                      <td className="px-3 py-2 text-right">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setSelected(r.work_order.id)}
                        >
                          Review
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <BillingCaseDrawer workOrderId={selected} onClose={() => setSelected(null)} />
        </div>
      </DispatcherShell>
    </ProtectedRoute>
  );
}