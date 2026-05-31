import { useExpenses } from "@/hooks/useExpenses";
import { useEvidenceFiles } from "@/hooks/useEvidenceFiles";

export function ReceiptList({ workOrderId }: { workOrderId: string }) {
  const { data: expenses } = useExpenses(workOrderId);
  const { data: files } = useEvidenceFiles(workOrderId);
  const receipts = (files ?? []).filter((f) => f.file_kind === "receipt_photo");
  const linked = new Set(
    (expenses ?? []).map((e) => e.receipt_file_id).filter(Boolean) as string[],
  );

  return (
    <div className="rounded-sm border border-border bg-card p-3">
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Receipts ({receipts.length})
      </h3>
      {receipts.length === 0 ? (
        <p className="text-xs text-muted-foreground">No receipts attached.</p>
      ) : (
        <ul className="space-y-1 text-xs">
          {receipts.map((r) => (
            <li key={r.id} className="flex items-center justify-between">
              <span className="truncate">{r.storage_path.split("/").pop()}</span>
              <span className="text-muted-foreground">
                {linked.has(r.id) ? "linked" : "unlinked"}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}