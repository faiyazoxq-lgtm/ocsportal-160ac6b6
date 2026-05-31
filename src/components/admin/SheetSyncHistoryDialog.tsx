import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useSheetSyncHistory } from "@/hooks/useSheetSyncHistory";
import { CloudUpload, CloudDownload, AlertTriangle, Check, X } from "lucide-react";

export function SheetSyncHistoryDialog({
  workOrderId,
  open,
  onOpenChange,
}: {
  workOrderId?: string | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const { data: rows = [], isLoading, error } = useSheetSyncHistory(workOrderId ?? undefined);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-base">
            Planner sync history{workOrderId ? " · this job" : " · recent activity"}
          </DialogTitle>
        </DialogHeader>
        {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
        {error && (
          <p className="text-sm text-red-700">Couldn't load sync history.</p>
        )}
        {!isLoading && rows.length === 0 && (
          <p className="text-sm text-muted-foreground">No sync activity yet.</p>
        )}
        <div className="max-h-[60vh] overflow-y-auto">
          <ul className="divide-y divide-border">
            {rows.map((r) => {
              const Icon = r.sync_direction === "app_to_sheet" ? CloudUpload : CloudDownload;
              const status = r.sync_status;
              const statusColor =
                status === "success"
                  ? "text-emerald-700"
                  : status === "conflict"
                    ? "text-amber-700"
                    : status === "failed"
                      ? "text-red-700"
                      : "text-muted-foreground";
              return (
                <li key={r.id} className="flex items-start gap-2 py-2 text-xs">
                  <Icon className="mt-0.5 h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">
                        {r.sync_direction === "app_to_sheet" ? "Push" : "Pull"}
                      </span>
                      <span className={`inline-flex items-center gap-0.5 font-semibold uppercase ${statusColor}`}>
                        {status === "success" && <Check className="h-3 w-3" />}
                        {status === "failed" && <X className="h-3 w-3" />}
                        {status === "conflict" && <AlertTriangle className="h-3 w-3" />}
                        {status}
                      </span>
                      {r.sheet_row_key && (
                        <span className="text-muted-foreground">· {r.sheet_row_key}</span>
                      )}
                      <span className="ml-auto text-muted-foreground">
                        {new Date(r.created_at).toLocaleString()}
                      </span>
                    </div>
                    {r.error_message && (
                      <p className="mt-0.5 break-words text-red-700">{r.error_message}</p>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      </DialogContent>
    </Dialog>
  );
}