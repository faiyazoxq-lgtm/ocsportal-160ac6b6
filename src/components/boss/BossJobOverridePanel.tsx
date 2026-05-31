import { useState } from "react";
import { useBossAllWorkOrders, useBossJobOverrides } from "@/hooks/useBossJobOverrides";

const STATUS_OPTIONS = [
  "ingested", "parsed_ready", "categorized", "admin_attention",
  "ready_for_dispatch", "assigned", "accepted", "en_route", "on_site",
  "field_in_progress", "field_submitted_complete", "field_submitted_incomplete",
  "dispatcher_review", "follow_up_required", "closed", "cancelled",
];

export function BossJobOverridePanel() {
  const { data: jobs, isLoading } = useBossAllWorkOrders();
  const { overrideWorkOrder } = useBossJobOverrides();
  const [filter, setFilter] = useState("");

  const filtered = (jobs ?? []).filter((j) =>
    !filter || j.order_no?.toLowerCase().includes(filter.toLowerCase()) ||
    j.job_summary?.toLowerCase().includes(filter.toLowerCase()),
  );

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">All jobs</h2>
        <input
          placeholder="Filter…"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="rounded-sm border border-input bg-background px-2 py-1 text-xs"
        />
      </div>
      {isLoading ? (
        <p className="text-xs text-muted-foreground">Loading…</p>
      ) : (
        <div className="overflow-hidden rounded-md border border-border bg-card">
          <table className="w-full text-xs">
            <thead className="bg-muted text-left text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-medium">Order</th>
                <th className="px-3 py-2 font-medium">Summary</th>
                <th className="px-3 py-2 font-medium">Status</th>
                <th className="px-3 py-2 font-medium">Priority</th>
                <th className="px-3 py-2 font-medium text-right">Override</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((j) => (
                <tr key={j.id} className="border-t border-border">
                  <td className="px-3 py-2 font-medium">{j.order_no}</td>
                  <td className="px-3 py-2 text-muted-foreground">{j.job_summary ?? "—"}</td>
                  <td className="px-3 py-2">{j.current_status}</td>
                  <td className="px-3 py-2">{j.priority_level}</td>
                  <td className="px-3 py-2 text-right">
                    <select
                      defaultValue=""
                      onChange={(e) => {
                        const newStatus = e.target.value;
                        if (!newStatus) return;
                        const reason = window.prompt("Reason for status override?");
                        if (!reason) { e.currentTarget.value = ""; return; }
                        overrideWorkOrder.mutate({
                          workOrderId: j.id,
                          reason,
                          changes: { current_status: newStatus },
                        });
                      }}
                      className="rounded-sm border border-input bg-background px-2 py-1 text-xs"
                    >
                      <option value="">Set status…</option>
                      {STATUS_OPTIONS.map((s) => (<option key={s} value={s}>{s}</option>))}
                    </select>
                    {j.field_lock_active && (
                      <button
                        className="ml-2 text-xs text-primary hover:underline"
                        onClick={() => {
                          const reason = window.prompt("Reason for force-unlock?");
                          if (!reason) return;
                          overrideWorkOrder.mutate({
                            workOrderId: j.id, reason,
                            changes: { field_lock_active: false },
                          });
                        }}
                      >Force-unlock</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}