import { WorkOrderDocumentsPanel } from "@/components/documents/WorkOrderDocumentsPanel";
import type { FieldSubmission } from "@/hooks/usePostCompletionQueue";
import { Check, X } from "lucide-react";

export function EvidenceReviewPanel({
  workOrderId,
  submission,
}: {
  workOrderId: string;
  submission: FieldSubmission | null;
}) {
  const ev = submission?.evidence ?? {};
  const rows: Array<[string, boolean | undefined]> = [
    ["Arrival photo", ev.arrival],
    ["Before-leaving photo", ev.before_leaving],
    ["Customer signature", ev.signature],
  ];

  return (
    <div className="space-y-3">
      <ul className="grid grid-cols-3 gap-2">
        {rows.map(([label, ok]) => (
          <li
            key={label}
            className="rounded-sm border border-border bg-card px-2 py-1.5 text-[11px]"
          >
            <div className="flex items-center gap-1 font-medium text-foreground">
              {ok ? (
                <Check className="h-3.5 w-3.5 text-emerald-600" />
              ) : (
                <X className="h-3.5 w-3.5 text-amber-600" />
              )}
              {label}
            </div>
            <div className="text-muted-foreground">
              {ok ? "Submitted" : "Missing"}
            </div>
          </li>
        ))}
      </ul>
      <WorkOrderDocumentsPanel workOrderId={workOrderId} canUpload={false} />
    </div>
  );
}