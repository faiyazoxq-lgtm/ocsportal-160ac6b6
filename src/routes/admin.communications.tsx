import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { DispatcherShell } from "@/components/DispatcherShell";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { useFollowUpQueue, useUpdateFollowUpStatus, type FollowUpFilters } from "@/hooks/useCommunications";
import {
  COMMUNICATION_TYPES,
  FOLLOW_UP_STATUSES,
  EXTERNAL_CONTACT_TYPES,
  type CommunicationType,
  type FollowUpStatus,
  type ExternalContactType,
} from "@/types/communications";
import { CommunicationTypeBadge, FollowUpBadge } from "@/components/admin/communications/CommunicationTypeBadge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { CheckCircle2 } from "lucide-react";

export const Route = createFileRoute("/admin/communications")({
  head: () => ({ meta: [{ title: "Follow-ups · OCS" }] }),
  component: CommunicationsPage,
});

const BUCKETS: Array<{ key: NonNullable<FollowUpFilters["bucket"]>; label: string }> = [
  { key: "all", label: "All" },
  { key: "overdue", label: "Overdue" },
  { key: "today", label: "Due today" },
  { key: "upcoming", label: "Upcoming" },
  { key: "unresolved", label: "Unresolved" },
];

function CommunicationsPage() {
  const [filters, setFilters] = useState<FollowUpFilters>({ bucket: "all" });
  const { data: rows = [], isLoading } = useFollowUpQueue(filters);
  const updateStatus = useUpdateFollowUpStatus();

  return (
    <ProtectedRoute requireRole="dispatcher">
      <DispatcherShell>
        <AdminPageHeader title="External follow-ups" description="Client and stakeholder communications awaiting action" />

        <div className="mb-3 flex flex-wrap gap-1.5">
          {BUCKETS.map((b) => (
            <button
              key={b.key}
              onClick={() => setFilters((f) => ({ ...f, bucket: b.key }))}
              className={`rounded-sm border px-2.5 py-1 text-xs font-medium ${
                filters.bucket === b.key
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-card hover:bg-muted"
              }`}
            >
              {b.label}
            </button>
          ))}
        </div>

        <div className="mb-3 grid grid-cols-2 gap-2 md:grid-cols-5">
          <Select value={filters.type ?? "all"} onValueChange={(v) => setFilters((f) => ({ ...f, type: v as CommunicationType | "all" }))}>
            <SelectTrigger><SelectValue placeholder="Type" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All types</SelectItem>
              {COMMUNICATION_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filters.status ?? "all"} onValueChange={(v) => setFilters((f) => ({ ...f, status: v as FollowUpStatus | "all" }))}>
            <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              {FOLLOW_UP_STATUSES.map((s) => <SelectItem key={s} value={s}>{s.replace(/_/g, " ")}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filters.contactType ?? "all"} onValueChange={(v) => setFilters((f) => ({ ...f, contactType: v as ExternalContactType | "all" }))}>
            <SelectTrigger><SelectValue placeholder="Contact" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All contacts</SelectItem>
              {EXTERNAL_CONTACT_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
            </SelectContent>
          </Select>
          <Input type="date" value={filters.fromDate ?? ""} onChange={(e) => setFilters((f) => ({ ...f, fromDate: e.target.value || null }))} />
          <Input type="date" value={filters.toDate ?? ""} onChange={(e) => setFilters((f) => ({ ...f, toDate: e.target.value || null }))} />
        </div>

        {isLoading ? (
          <div className="text-sm text-muted-foreground">Loading follow-ups…</div>
        ) : rows.length === 0 ? (
          <div className="rounded-md border border-border bg-card p-6 text-center text-sm text-muted-foreground">
            No follow-ups match these filters.
          </div>
        ) : (
          <ul className="space-y-2">
            {rows.map((r) => (
              <li key={r.id} className="rounded-md border border-border bg-card p-3 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <CommunicationTypeBadge type={r.communication_type} direction={r.direction} />
                  <FollowUpBadge status={r.follow_up_status} dueAt={r.follow_up_due_at} />
                  {r.work_order && (
                    <span className="rounded-sm bg-secondary px-1.5 py-0.5 text-[10px] font-medium uppercase">
                      {r.work_order.order_no}
                    </span>
                  )}
                  <span className="ml-auto text-xs text-muted-foreground">
                    {r.follow_up_due_at ? `Due ${new Date(r.follow_up_due_at).toLocaleString()}` : `Logged ${new Date(r.occurred_at).toLocaleString()}`}
                  </span>
                </div>
                <div className="mt-1.5 text-xs text-muted-foreground">
                  {r.contact?.name ?? "—"}
                  {r.contact?.organization ? ` · ${r.contact.organization}` : ""}
                </div>
                {r.subject && <div className="mt-0.5 font-medium">{r.subject}</div>}
                {r.summary && <p className="mt-0.5 whitespace-pre-wrap text-foreground/90">{r.summary}</p>}
                {r.work_order?.job_summary && (
                  <div className="mt-1 text-[11px] text-muted-foreground">
                    Job: {r.work_order.job_summary}
                  </div>
                )}
                <div className="mt-2 flex items-center gap-2 border-t border-border pt-2">
                  <Select
                    value={r.follow_up_status ?? "awaiting_response"}
                    onValueChange={(v) => updateStatus.mutate({ id: r.id, follow_up_status: v as FollowUpStatus })}
                  >
                    <SelectTrigger className="h-7 w-48 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {FOLLOW_UP_STATUSES.filter((s) => s !== "not_required").map((s) => (
                        <SelectItem key={s} value={s}>{s.replace(/_/g, " ")}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => updateStatus.mutate({ id: r.id, follow_up_status: "resolved" })}
                  >
                    <CheckCircle2 className="mr-1 h-3.5 w-3.5" />Resolve
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </DispatcherShell>
    </ProtectedRoute>
  );
}