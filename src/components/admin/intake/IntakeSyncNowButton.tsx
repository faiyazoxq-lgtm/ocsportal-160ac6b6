import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { RefreshCw, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { forceResyncIntakeFromGmail, getGmailMailboxStatus } from "@/lib/gmail.functions";
import { toast } from "sonner";

export function IntakeSyncNowButton() {
  const qc = useQueryClient();
  const resync = useServerFn(forceResyncIntakeFromGmail);
  const status = useServerFn(getGmailMailboxStatus);
  const [lastResult, setLastResult] = useState<{
    scanned: number;
    cached: number;
    autoImported: number;
    reanalyzed?: number;
    reimported?: number;
    at: string;
  } | null>(null);

  const statusQuery = useQuery({
    queryKey: ["gmail", "status"],
    queryFn: () => status({}),
    refetchOnWindowFocus: false,
  });

  const mut = useMutation({
    mutationFn: () => resync({}),
    onSuccess: (r) => {
      setLastResult({ ...r, at: new Date().toISOString() });
      qc.invalidateQueries({ queryKey: ["intake_records"] });
      qc.invalidateQueries({ queryKey: ["gmail"] });
      const newCount = (r.cached ?? 0) + (r.reimported ?? 0);
      toast.success(
        newCount > 0
          ? `Sync complete · ${newCount} new intake item${newCount === 1 ? "" : "s"}`
          : `Sync complete · scanned ${r.scanned}, no new items`,
      );
    },
    onError: (e) => {
      toast.error(e instanceof Error ? e.message : "Sync failed");
    },
  });

  useEffect(() => {
    // clear stale state on unmount
    return () => setLastResult(null);
  }, []);

  const linked = statusQuery.data?.linked ?? false;
  const lastSyncAt = statusQuery.data?.record?.last_sync_at ?? null;
  const state: "idle" | "syncing" | "completed" | "failed" = mut.isPending
    ? "syncing"
    : mut.isError
      ? "failed"
      : mut.isSuccess
        ? "completed"
        : "idle";

  return (
    <div className="flex items-center gap-2">
      <Button
        size="sm"
        variant="default"
        onClick={() => mut.mutate()}
        disabled={!linked || mut.isPending}
        title={
          !linked
            ? "Connect the company Gmail mailbox first"
            : "Re-scan all emails and attachments, including archived ones"
        }
        className="inline-flex items-center gap-1.5"
      >
        {state === "syncing" ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : state === "completed" ? (
          <CheckCircle2 className="h-3.5 w-3.5" />
        ) : state === "failed" ? (
          <AlertCircle className="h-3.5 w-3.5" />
        ) : (
          <RefreshCw className="h-3.5 w-3.5" />
        )}
        {state === "syncing" ? "Syncing…" : "Sync now"}
      </Button>
      <div className="hidden text-[11px] leading-tight text-muted-foreground sm:block">
        {state === "syncing" && <span>Re-scanning emails & attachments…</span>}
        {state !== "syncing" && lastResult && (
          <span>
            Last: scanned {lastResult.scanned}
            {(lastResult.cached ?? 0) > 0 ? ` · ${lastResult.cached} new` : ""}
            {(lastResult.reimported ?? 0) > 0 ? ` · ${lastResult.reimported} recovered` : ""}
            {(lastResult.reanalyzed ?? 0) > 0 ? ` · ${lastResult.reanalyzed} re-analyzed` : ""}
          </span>
        )}
        {state !== "syncing" && !lastResult && lastSyncAt && (
          <span>Last sync {new Date(lastSyncAt).toLocaleString()}</span>
        )}
        {!linked && <span className="text-amber-600">Gmail mailbox not connected</span>}
      </div>
    </div>
  );
}