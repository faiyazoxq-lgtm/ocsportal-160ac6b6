import { useEffect, useRef, useState } from "react";
import { CloudDownload, History, CloudUpload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePlannerSync } from "@/hooks/usePlannerSync";
import { SheetSyncHistoryDialog } from "./SheetSyncHistoryDialog";

const AUTO_PULL_INTERVAL_MS = 60_000;
const STORAGE_KEY = "ocs.plannerAutoPull";

export function PlannerAutoPullToggle({ visibleIds }: { visibleIds: string[] }) {
  const { pull, batchPush } = usePlannerSync();
  const [enabled, setEnabled] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem(STORAGE_KEY) === "on";
  });
  const [historyOpen, setHistoryOpen] = useState(false);
  const pulling = useRef(false);

  useEffect(() => {
    if (!enabled) return;
    const tick = async () => {
      if (pulling.current) return;
      pulling.current = true;
      try { await pull.mutateAsync(undefined); } catch { /* toast shown */ }
      finally { pulling.current = false; }
    };
    const id = setInterval(tick, AUTO_PULL_INTERVAL_MS);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <label className="inline-flex items-center gap-2 rounded-sm border border-border bg-card px-2 py-1 text-xs">
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => {
            setEnabled(e.target.checked);
            if (typeof window !== "undefined") {
              localStorage.setItem(STORAGE_KEY, e.target.checked ? "on" : "off");
            }
          }}
        />
        Auto-pull planner (60s)
      </label>
      <Button size="sm" variant="outline" onClick={() => pull.mutate(undefined)} disabled={pull.isPending}>
        <CloudDownload className="mr-1 h-3.5 w-3.5" />
        Pull now
      </Button>
      <Button
        size="sm"
        variant="outline"
        onClick={() => batchPush.mutate(visibleIds)}
        disabled={batchPush.isPending || visibleIds.length === 0}
      >
        <CloudUpload className="mr-1 h-3.5 w-3.5" />
        {batchPush.isPending ? "Pushing…" : `Push visible (${visibleIds.length})`}
      </Button>
      <Button size="sm" variant="ghost" onClick={() => setHistoryOpen(true)}>
        <History className="mr-1 h-3.5 w-3.5" />
        Sync history
      </Button>
      <SheetSyncHistoryDialog open={historyOpen} onOpenChange={setHistoryOpen} />
    </div>
  );
}