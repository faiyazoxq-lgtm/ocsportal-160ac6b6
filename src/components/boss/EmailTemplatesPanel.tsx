import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  listEmailTemplates,
  upsertEmailTemplate,
  deleteEmailTemplate,
  type EmailTemplate,
} from "@/lib/emailTemplates.functions";

interface Draft {
  id?: string;
  slug: string;
  name: string;
  subject: string;
  body: string;
  sort_order: number;
  is_active: boolean;
}

const EMPTY: Draft = {
  slug: "",
  name: "",
  subject: "",
  body: "",
  sort_order: 100,
  is_active: true,
};

export function EmailTemplatesPanel() {
  const qc = useQueryClient();
  const fetchList = useServerFn(listEmailTemplates);
  const upsert = useServerFn(upsertEmailTemplate);
  const del = useServerFn(deleteEmailTemplate);

  const { data, isLoading } = useQuery({
    queryKey: ["email_templates"],
    queryFn: () => fetchList(),
  });
  const templates = data?.templates ?? [];

  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [err, setErr] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  const editing = !!draft.id;

  const saveMutation = useMutation({
    mutationFn: (d: Draft) => upsert({ data: d }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["email_templates"] });
      setSavedAt(Date.now());
    },
  });
  const deleteMutation = useMutation({
    mutationFn: (id: string) => del({ data: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["email_templates"] }),
  });

  const startNew = () => {
    setDraft(EMPTY);
    setErr(null);
    setSavedAt(null);
  };
  const startEdit = (t: EmailTemplate) => {
    setDraft({
      id: t.id,
      slug: t.slug,
      name: t.name,
      subject: t.subject,
      body: t.body,
      sort_order: t.sort_order,
      is_active: t.is_active,
    });
    setErr(null);
    setSavedAt(null);
  };

  const onSave = async () => {
    setErr(null);
    try {
      await saveMutation.mutateAsync(draft);
      startNew();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Failed to save template");
    }
  };

  const onDelete = async (id: string) => {
    if (!confirm("Delete this template? This cannot be undone.")) return;
    try {
      await deleteMutation.mutateAsync(id);
      if (draft.id === id) startNew();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Failed to delete template");
    }
  };

  return (
    <section className="rounded-md border border-border bg-card p-4">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold">OCSBot email templates</h2>
          <p className="text-xs text-muted-foreground">
            Reusable subject + body presets shown in the Telegram Emails flow.
            Use <code className="text-[11px]">{`{{name}}`}</code> to auto-insert the recipient's name.
          </p>
        </div>
        <button
          onClick={startNew}
          className="rounded-sm border border-input bg-background px-3 py-1.5 text-xs hover:bg-accent"
        >
          + New template
        </button>
      </div>

      {isLoading ? (
        <p className="text-xs text-muted-foreground">Loading…</p>
      ) : templates.length === 0 ? (
        <p className="text-xs text-muted-foreground">No templates yet.</p>
      ) : (
        <ul className="mb-4 divide-y divide-border rounded-sm border border-border">
          {templates.map((t) => (
            <li key={t.id} className="flex items-center justify-between gap-3 px-3 py-2">
              <div className="min-w-0">
                <div className="flex items-center gap-2 text-xs font-medium">
                  <span className="truncate">{t.name}</span>
                  {!t.is_active && (
                    <span className="rounded-sm bg-muted px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                      inactive
                    </span>
                  )}
                </div>
                <div className="truncate text-[11px] text-muted-foreground">
                  <code className="text-[10px]">{t.slug}</code> · {t.subject}
                </div>
              </div>
              <div className="flex shrink-0 gap-1">
                <button
                  onClick={() => startEdit(t)}
                  className="rounded-sm border border-input bg-background px-2 py-1 text-[11px] hover:bg-accent"
                >
                  Edit
                </button>
                <button
                  onClick={() => onDelete(t.id)}
                  className="rounded-sm border border-input bg-background px-2 py-1 text-[11px] text-destructive hover:bg-accent"
                >
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <div className="rounded-sm border border-dashed border-border p-3">
        <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          {editing ? "Edit template" : "New template"}
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          <Field label="Name">
            <input
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              className="w-full rounded-sm border border-input bg-background px-2 py-1.5 text-xs"
              placeholder="Appointment confirmation"
            />
          </Field>
          <Field label="Slug (unique, a–z 0–9 _)">
            <input
              value={draft.slug}
              onChange={(e) => setDraft({ ...draft, slug: e.target.value.toLowerCase() })}
              className="w-full rounded-sm border border-input bg-background px-2 py-1.5 text-xs"
              placeholder="appointment_confirmation"
            />
          </Field>
          <Field label="Subject">
            <input
              value={draft.subject}
              onChange={(e) => setDraft({ ...draft, subject: e.target.value })}
              className="w-full rounded-sm border border-input bg-background px-2 py-1.5 text-xs"
              placeholder="Appointment confirmed"
            />
          </Field>
          <Field label="Sort order">
            <input
              type="number"
              value={draft.sort_order}
              onChange={(e) => setDraft({ ...draft, sort_order: Number(e.target.value) || 0 })}
              className="w-full rounded-sm border border-input bg-background px-2 py-1.5 text-xs"
            />
          </Field>
        </div>
        <Field label="Body">
          <textarea
            value={draft.body}
            onChange={(e) => setDraft({ ...draft, body: e.target.value })}
            rows={8}
            className="w-full rounded-sm border border-input bg-background px-2 py-1.5 font-mono text-xs"
            placeholder={"Hi {{name}},\n\nThis is to confirm…\n\nKind regards"}
          />
        </Field>
        <label className="mt-1 inline-flex items-center gap-2 text-xs">
          <input
            type="checkbox"
            checked={draft.is_active}
            onChange={(e) => setDraft({ ...draft, is_active: e.target.checked })}
          />
          Active (shown in Telegram template picker)
        </label>
        <div className="mt-3 flex items-center gap-2">
          <button
            onClick={onSave}
            disabled={saveMutation.isPending}
            className="rounded-sm bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
          >
            {saveMutation.isPending ? "Saving…" : editing ? "Save changes" : "Create template"}
          </button>
          {editing && (
            <button
              onClick={startNew}
              className="rounded-sm border border-input bg-background px-3 py-1.5 text-xs hover:bg-accent"
            >
              Cancel edit
            </button>
          )}
          {err && <span className="text-xs text-destructive">{err}</span>}
          {savedAt && !err && <span className="text-[11px] text-muted-foreground">Saved.</span>}
        </div>
      </div>
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <div className="mb-1 text-[11px] font-medium text-muted-foreground">{label}</div>
      {children}
    </label>
  );
}