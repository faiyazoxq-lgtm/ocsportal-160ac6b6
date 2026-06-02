import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Loader2, Save, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useEngineerPermissions } from "@/hooks/useEngineerPermissions";
import {
  ENGINEER_PERMISSION_CATEGORIES,
  defaultEngineerPermissions,
  type EngineerPermissions,
} from "@/lib/engineerPermissions";
import { updateEngineerPermissions } from "@/lib/companySettings.functions";

export function EngineerPermissionsSettings() {
  const { data, isLoading } = useEngineerPermissions();
  const qc = useQueryClient();
  const save = useServerFn(updateEngineerPermissions);
  const [draft, setDraft] = useState<EngineerPermissions>(defaultEngineerPermissions());

  useEffect(() => {
    if (data) setDraft(data);
  }, [data]);

  const mutation = useMutation({
    mutationFn: () => save({ data: { engineer_permissions: draft } }),
    onSuccess: () => {
      toast.success("Engineer permissions saved");
      qc.invalidateQueries({ queryKey: ["engineer_permissions"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  function toggle(catId: keyof EngineerPermissions, key: string, value: boolean) {
    setDraft((prev) => ({
      ...prev,
      [catId]: { ...prev[catId], [key]: value },
    }));
  }

  function resetDefaults() {
    setDraft(defaultEngineerPermissions());
  }

  return (
    <section className="rounded-md border border-border bg-card">
      <header className="flex items-start justify-between gap-3 border-b border-border p-4">
        <div className="flex items-start gap-2">
          <ShieldCheck className="mt-0.5 h-4 w-4 text-foreground" />
          <div>
            <h2 className="text-sm font-semibold">Engineer permissions</h2>
            <p className="text-xs text-muted-foreground">
              Control what data engineers see across jobs and the directory. Boss and
              dispatcher views are unaffected.
            </p>
          </div>
        </div>
        <div className="flex shrink-0 gap-2">
          <Button type="button" size="sm" variant="ghost" onClick={resetDefaults}>
            Reset defaults
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending || isLoading}
          >
            {mutation.isPending ? (
              <Loader2 className="mr-1 h-3 w-3 animate-spin" />
            ) : (
              <Save className="mr-1 h-3 w-3" />
            )}
            Save
          </Button>
        </div>
      </header>
      {isLoading ? (
        <div className="p-4 text-xs text-muted-foreground">Loading…</div>
      ) : (
        <div className="divide-y divide-border">
          {ENGINEER_PERMISSION_CATEGORIES.map((cat) => (
            <div key={cat.id} className="p-4">
              <div className="mb-2">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-foreground">
                  {cat.title}
                </h3>
                <p className="text-xs text-muted-foreground">{cat.description}</p>
              </div>
              <ul className="grid gap-2 md:grid-cols-2">
                {cat.toggles.map((t) => {
                  const value = Boolean(draft[cat.id]?.[t.key]);
                  return (
                    <li
                      key={t.key}
                      className="flex items-start justify-between gap-3 rounded-sm border border-border bg-background px-3 py-2"
                    >
                      <div className="min-w-0">
                        <div className="text-xs font-semibold text-foreground">{t.label}</div>
                        <div className="text-[11px] text-muted-foreground">{t.description}</div>
                      </div>
                      <Switch
                        checked={value}
                        onCheckedChange={(v) => toggle(cat.id, t.key, v)}
                        aria-label={t.label}
                      />
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}