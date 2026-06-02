import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Inbox } from "lucide-react";
import { updateIntakeSniffingEmail } from "@/lib/companySettings.functions";
import { useSiteSettings } from "@/hooks/useSiteSettings";

export function SniffingEmailPanel() {
  const qc = useQueryClient();
  const { data, isLoading } = useSiteSettings();
  const save = useServerFn(updateIntakeSniffingEmail);
  const mutate = useMutation({
    mutationFn: (v: string | null) => save({ data: { intake_sniffing_email: v } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["site_settings"] }),
  });

  const [email, setEmail] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  useEffect(() => {
    setEmail(data?.intake_sniffing_email ?? "");
  }, [data?.intake_sniffing_email]);

  const onSave = async () => {
    setErr(null);
    try {
      await mutate.mutateAsync(email ? email : null);
      setSavedAt(Date.now());
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Failed to save");
    }
  };

  return (
    <section className="rounded-md border border-border bg-card p-4">
      <div className="mb-1 flex items-center gap-2">
        <Inbox className="h-4 w-4 text-muted-foreground" />
        <h2 className="text-sm font-semibold">Linked sniffing inbox</h2>
      </div>
      <p className="mb-3 text-xs text-muted-foreground">
        Inbound work orders sent to this address are auto-parsed and routed into the intake queue.
        Share this address with clients so jobs land in the system automatically.
      </p>
      {isLoading ? (
        <p className="text-xs text-muted-foreground">Loading…</p>
      ) : (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="ocsdashboard@gmail.com"
            className="flex-1 rounded-sm border border-input bg-background px-3 py-2 text-xs text-foreground"
          />
          <button
            onClick={onSave}
            disabled={mutate.isPending}
            className="rounded-sm bg-primary px-3 py-2 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
          >
            {mutate.isPending ? "Saving…" : "Save"}
          </button>
        </div>
      )}
      {err && <p className="mt-2 text-xs text-destructive">{err}</p>}
      {savedAt && !err && (
        <p className="mt-2 text-[11px] text-muted-foreground">Saved.</p>
      )}
    </section>
  );
}