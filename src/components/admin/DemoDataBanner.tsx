import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Database, RotateCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export function DemoDataBanner() {
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);

  const reseed = async () => {
    setBusy(true);
    const { error } = await supabase.rpc("seed_demo_data");
    setBusy(false);
    if (error) {
      toast.error("Reseed failed", { description: error.message });
      return;
    }
    await qc.invalidateQueries();
    toast.success("Demo data reset", {
      description: "All OCS-DEMO-* records have been refreshed.",
    });
  };

  return (
    <div className="flex items-center justify-between gap-3 border-b border-amber-300/60 bg-amber-50 px-4 py-2 text-xs text-amber-900 md:px-6 dark:bg-amber-950/40 dark:text-amber-100">
      <div className="flex items-center gap-2">
        <Database className="h-3.5 w-3.5" />
        <span>
          <strong className="font-semibold">Demo environment.</strong>{" "}
          This workspace contains seeded test data (clients, engineers, and work orders prefixed{" "}
          <code className="rounded bg-amber-100 px-1 dark:bg-amber-900/60">OCS-DEMO-*</code>).
        </span>
      </div>
      <button
        type="button"
        onClick={() => void reseed()}
        disabled={busy}
        className="inline-flex items-center gap-1.5 rounded-sm border border-amber-400/70 bg-white px-2.5 py-1 text-[11px] font-medium text-amber-900 hover:bg-amber-100 disabled:opacity-60 dark:bg-amber-900/30 dark:text-amber-100"
      >
        <RotateCw className={`h-3 w-3 ${busy ? "animate-spin" : ""}`} />
        {busy ? "Reseeding…" : "Reset demo data"}
      </button>
    </div>
  );
}