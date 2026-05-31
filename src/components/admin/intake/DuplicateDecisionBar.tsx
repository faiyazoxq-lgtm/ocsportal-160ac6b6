import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { useResolveDuplicateReview } from "@/hooks/useDuplicates";
import type { IntakeRecord } from "@/types/intake";

interface Props {
  record: IntakeRecord;
  selectedWorkOrderId?: string | undefined;
}

/**
 * Reviewer action bar: confirm / dismiss / link a duplicate.
 * - confirm: marks the intake as a confirmed duplicate (rejected, audited)
 * - dismissed: clears the duplicate suspicion (returns to needs_review)
 * - linked: confirms + records the linked existing work order
 */
export function DuplicateDecisionBar({ record, selectedWorkOrderId }: Props) {
  const resolve = useResolveDuplicateReview();
  const [note, setNote] = useState("");
  const status = record.duplicate_review_status ?? "open";
  const settled = status === "confirmed" || status === "linked" || status === "dismissed";

  async function decide(decision: "dismissed" | "confirmed" | "linked") {
    if (decision === "linked" && !selectedWorkOrderId) {
      toast.error("Select a work order candidate to link first");
      return;
    }
    try {
      await resolve.mutateAsync({
        intakeId: record.id,
        decision,
        workOrderId: decision === "linked" ? selectedWorkOrderId : undefined,
        note: note.trim() || undefined,
      });
      toast.success(
        decision === "dismissed"
          ? "Duplicate suspicion dismissed"
          : decision === "linked"
            ? "Linked to existing work order"
            : "Confirmed duplicate",
      );
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  return (
    <div className="space-y-2 border-t border-border bg-muted/30 px-3 py-2">
      <div className="flex flex-wrap items-center gap-2">
        <Input
          placeholder="Decision note (optional, audited)"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          className="h-8 flex-1 min-w-[180px] text-xs"
        />
        <Button
          size="sm"
          variant="outline"
          className="h-8"
          disabled={resolve.isPending}
          onClick={() => decide("dismissed")}
        >
          Dismiss
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="h-8"
          disabled={resolve.isPending || !selectedWorkOrderId}
          onClick={() => decide("linked")}
          title={!selectedWorkOrderId ? "Pick a work order candidate first" : undefined}
        >
          Link & reject
        </Button>
        <Button
          size="sm"
          variant="destructive"
          className="h-8"
          disabled={resolve.isPending}
          onClick={() => decide("confirmed")}
        >
          Confirm duplicate
        </Button>
      </div>
      {settled && (
        <div className="text-[11px] text-muted-foreground">
          Decision recorded: <span className="font-medium text-foreground">{status}</span>
          {record.duplicate_resolved_at
            ? ` · ${new Date(record.duplicate_resolved_at).toLocaleString()}`
            : ""}
          . Dispatchers can override by re-scanning or changing the decision.
        </div>
      )}
    </div>
  );
}