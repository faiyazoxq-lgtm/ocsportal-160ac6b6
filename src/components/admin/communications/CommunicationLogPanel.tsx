import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useUpdateFollowUpStatus, useWorkOrderCommunications } from "@/hooks/useCommunications";
import { CommunicationTypeBadge, FollowUpBadge } from "./CommunicationTypeBadge";
import { AddCommunicationEntryDrawer } from "./AddCommunicationEntryDrawer";
import { ExternalContactsCard } from "./ExternalContactsCard";
import { Plus, CheckCircle2 } from "lucide-react";
import { FOLLOW_UP_STATUSES, type FollowUpStatus } from "@/types/communications";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export function CommunicationLogPanel({ workOrderId }: { workOrderId: string }) {
  const { data: entries = [], isLoading } = useWorkOrderCommunications(workOrderId);
  const updateStatus = useUpdateFollowUpStatus();
  const [open, setOpen] = useState(false);

  return (
    <div className="space-y-4">
      <div>
        <div className="mb-2 flex items-center justify-between">
          <h4 className="text-[11px] font-semibold uppercase text-muted-foreground">Linked contacts</h4>
        </div>
        <ExternalContactsCard workOrderId={workOrderId} />
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between">
          <h4 className="text-[11px] font-semibold uppercase text-muted-foreground">Communication history</h4>
          <Button size="sm" onClick={() => setOpen(true)}>
            <Plus className="mr-1 h-3.5 w-3.5" />Log
          </Button>
        </div>
        {isLoading ? (
          <div className="text-xs text-muted-foreground">Loading…</div>
        ) : entries.length === 0 ? (
          <div className="text-xs text-muted-foreground">No communications logged yet.</div>
        ) : (
          <ul className="space-y-2">
            {entries.map((e) => (
              <li key={e.id} className="rounded-sm border border-border bg-card p-2 text-xs">
                <div className="flex flex-wrap items-center gap-1.5">
                  <CommunicationTypeBadge type={e.communication_type} direction={e.direction} />
                  <FollowUpBadge status={e.follow_up_status ?? e.outcome} dueAt={e.follow_up_due_at} />
                  <span className="ml-auto text-muted-foreground">
                    {new Date(e.occurred_at).toLocaleString()}
                  </span>
                </div>
                <div className="mt-1.5">
                  {e.contact && (
                    <div className="text-muted-foreground">
                      {e.contact.name}{e.contact.organization ? ` · ${e.contact.organization}` : ""}
                    </div>
                  )}
                  {e.subject && <div className="font-medium">{e.subject}</div>}
                  {e.summary && <p className="whitespace-pre-wrap text-foreground/90">{e.summary}</p>}
                </div>
                {e.requires_follow_up && e.follow_up_status !== "resolved" && (
                  <div className="mt-2 flex items-center gap-2 border-t border-border pt-2">
                    <span className="text-[10px] uppercase text-muted-foreground">Update follow-up:</span>
                    <Select
                      value={e.follow_up_status ?? "awaiting_response"}
                      onValueChange={(v) => updateStatus.mutate({ id: e.id, follow_up_status: v as FollowUpStatus })}
                    >
                      <SelectTrigger className="h-7 w-44 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {FOLLOW_UP_STATUSES.filter((s) => s !== "not_required").map((s) => (
                          <SelectItem key={s} value={s}>{s.replace(/_/g, " ")}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <button
                      className="ml-auto inline-flex items-center gap-1 text-emerald-700 hover:underline"
                      onClick={() => updateStatus.mutate({ id: e.id, follow_up_status: "resolved" })}
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" />Resolve
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      <AddCommunicationEntryDrawer workOrderId={workOrderId} open={open} onOpenChange={setOpen} />
    </div>
  );
}