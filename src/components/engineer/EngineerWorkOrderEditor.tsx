import { useState } from "react";
import { toast } from "sonner";
import { Pencil, Save, X } from "lucide-react";
import {
  useUpdateEngineerWorkOrder,
  type EngineerEditableFields,
} from "@/hooks/useEngineerJobs";

/**
 * Inline editor that lets a lead engineer update the job details they're
 * allowed to change. Fields below match the RLS-permitted update surface
 * (no status, no role/assignment, no schedule). Saves propagate everywhere
 * via the hook's invalidations.
 */
export function EngineerWorkOrderEditor({
  workOrderId,
  initial,
  disabled,
}: {
  workOrderId: string;
  initial: EngineerEditableFields;
  disabled?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<EngineerEditableFields>(initial);
  const mutation = useUpdateEngineerWorkOrder(workOrderId);

  const reset = () => {
    setForm(initial);
    setEditing(false);
  };

  const onSave = () => {
    const patch: Partial<EngineerEditableFields> = {};
    (Object.keys(form) as (keyof EngineerEditableFields)[]).forEach((k) => {
      const next = form[k]?.toString().trim() ?? "";
      const prev = initial[k]?.toString().trim() ?? "";
      if (next !== prev) patch[k] = (next.length ? next : null) as never;
    });
    if (Object.keys(patch).length === 0) {
      toast.info("No changes to save");
      setEditing(false);
      return;
    }
    mutation.mutate(patch, {
      onSuccess: () => {
        toast.success("Job details updated", {
          description: "Changes are visible to dispatch and the rest of the team.",
        });
        setEditing(false);
      },
      onError: (err) =>
        toast.error("Couldn't save changes", {
          description: err instanceof Error ? err.message : "Unknown error",
        }),
    });
  };

  if (!editing) {
    return (
      <div className="flex items-center justify-end">
        <button
          type="button"
          onClick={() => setEditing(true)}
          disabled={disabled}
          className="inline-flex items-center gap-1.5 rounded-sm border border-border bg-background px-2.5 py-1 text-[11px] font-medium text-foreground hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60"
        >
          <Pencil className="h-3.5 w-3.5" />
          Edit job details
        </button>
      </div>
    );
  }

  const set = <K extends keyof EngineerEditableFields>(
    key: K,
    value: string,
  ) => setForm((p) => ({ ...p, [key]: value }));

  return (
    <div className="space-y-3 rounded-md border border-primary/30 bg-primary/5 p-3">
      <div className="text-xs font-semibold uppercase tracking-wider text-primary">
        Editing job details
      </div>

      <Field label="Job summary">
        <input
          value={form.job_summary ?? ""}
          onChange={(e) => set("job_summary", e.target.value.slice(0, 200))}
          className="w-full rounded-sm border border-border bg-background px-3 py-2 text-sm"
          placeholder="Short title for this job"
        />
      </Field>

      <Field label="Job description">
        <textarea
          value={form.job_description ?? ""}
          onChange={(e) => set("job_description", e.target.value.slice(0, 4000))}
          rows={4}
          className="w-full rounded-sm border border-border bg-background px-3 py-2 text-sm"
          placeholder="What's been found on site, scope, key details."
        />
      </Field>

      <Field label="Tools / materials">
        <textarea
          value={form.tools_materials_hint ?? ""}
          onChange={(e) => set("tools_materials_hint", e.target.value.slice(0, 1000))}
          rows={2}
          className="w-full rounded-sm border border-border bg-background px-3 py-2 text-sm"
          placeholder="Parts used / required."
        />
      </Field>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <Field label="Address line 1">
          <input
            value={form.address_line_1 ?? ""}
            onChange={(e) => set("address_line_1", e.target.value.slice(0, 200))}
            className="w-full rounded-sm border border-border bg-background px-3 py-2 text-sm"
          />
        </Field>
        <Field label="Address line 2">
          <input
            value={form.address_line_2 ?? ""}
            onChange={(e) => set("address_line_2", e.target.value.slice(0, 200))}
            className="w-full rounded-sm border border-border bg-background px-3 py-2 text-sm"
          />
        </Field>
        <Field label="City">
          <input
            value={form.city ?? ""}
            onChange={(e) => set("city", e.target.value.slice(0, 100))}
            className="w-full rounded-sm border border-border bg-background px-3 py-2 text-sm"
          />
        </Field>
        <Field label="Postcode">
          <input
            value={form.postcode ?? ""}
            onChange={(e) => set("postcode", e.target.value.slice(0, 20))}
            className="w-full rounded-sm border border-border bg-background px-3 py-2 text-sm"
          />
        </Field>
      </div>

      <div className="flex items-center justify-end gap-2 pt-1">
        <button
          type="button"
          onClick={reset}
          disabled={mutation.isPending}
          className="inline-flex items-center gap-1.5 rounded-sm border border-border bg-background px-3 py-1.5 text-xs font-medium hover:bg-muted"
        >
          <X className="h-3.5 w-3.5" />
          Cancel
        </button>
        <button
          type="button"
          onClick={onSave}
          disabled={mutation.isPending}
          className="inline-flex items-center gap-1.5 rounded-sm bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <Save className="h-3.5 w-3.5" />
          {mutation.isPending ? "Saving…" : "Save changes"}
        </button>
      </div>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </label>
      {children}
    </div>
  );
}