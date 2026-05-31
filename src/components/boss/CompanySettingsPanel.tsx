import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { updateCompanyWorkEmail } from "@/lib/companySettings.functions";

export function CompanySettingsPanel() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["company_settings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("company_settings")
        .select("work_email, updated_at")
        .eq("singleton", true)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
  const save = useServerFn(updateCompanyWorkEmail);
  const mutate = useMutation({
    mutationFn: (work_email: string | null) => save({ data: { work_email } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["company_settings"] }),
  });

  const [email, setEmail] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  useEffect(() => {
    setEmail(data?.work_email ?? "");
  }, [data?.work_email]);

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
      <h2 className="mb-1 text-sm font-semibold">Company work email</h2>
      <p className="mb-3 text-xs text-muted-foreground">
        Shared business email address shown to staff and used as the company contact.
      </p>
      {isLoading ? (
        <p className="text-xs text-muted-foreground">Loading…</p>
      ) : (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="info@yourcompany.com"
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