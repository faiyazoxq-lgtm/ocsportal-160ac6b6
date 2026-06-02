import { useEffect, useRef, useState } from "react";
import { Pencil, Check, X, Loader2 } from "lucide-react";
import { toast } from "sonner";

type Props = {
  label: string;
  value: string | number | null | undefined;
  /** Optional save handler. If omitted, field renders as read-only. */
  onSave?: (next: string) => void | Promise<void>;
  type?: "text" | "number" | "textarea" | "date";
  pre?: boolean;
  placeholder?: string;
  /** Display formatter (e.g. add £ prefix). Edit input still uses raw value. */
  display?: (v: string | number | null | undefined) => React.ReactNode;
  /** Optional last-edit info to show below the value. */
  lastEdit?: { at: string; actor: string | null } | null;
};

function formatRelative(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const diffMs = Date.now() - then;
  const m = Math.round(diffMs / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(iso).toLocaleDateString();
}

export function InlineEditableField({
  label,
  value,
  onSave,
  type = "text",
  pre,
  placeholder,
  display,
  lastEdit,
}: Props) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<string>(value == null ? "" : String(value));
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!editing) setDraft(value == null ? "" : String(value));
  }, [value, editing]);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  const cancel = () => {
    setDraft(value == null ? "" : String(value));
    setEditing(false);
  };

  const save = async () => {
    if (!onSave) return;
    const current = value == null ? "" : String(value);
    if (draft === current) {
      setEditing(false);
      return;
    }
    setSaving(true);
    try {
      await onSave(draft);
      setEditing(false);
    } catch (e) {
      toast.error(`Couldn't save ${label}: ${(e as Error).message}`);
    } finally {
      setSaving(false);
    }
  };

  const editable = Boolean(onSave);
  const isMultiline = type === "textarea";

  return (
    <div
      className={[
        "group grid grid-cols-[120px_1fr] items-start gap-2 text-xs",
        "rounded-sm px-1.5 py-1 -mx-1.5 transition-colors",
        editing ? "bg-accent/40 ring-1 ring-primary/30" : editable ? "hover:bg-muted/50" : "",
      ].join(" ")}
    >
      <div className="pt-1 text-muted-foreground select-none">{label}</div>
      <div className={`flex ${isMultiline ? "items-start" : "items-center"} gap-1 min-w-0`}>
        {editing ? (
          <>
            {isMultiline ? (
              <textarea
                ref={inputRef as React.RefObject<HTMLTextAreaElement>}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder={placeholder}
                rows={Math.min(8, Math.max(3, draft.split("\n").length + 1))}
                onKeyDown={(e) => {
                  if (e.key === "Escape") {
                    e.preventDefault();
                    cancel();
                  } else if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                    e.preventDefault();
                    void save();
                  }
                }}
                className="flex-1 min-w-0 rounded-sm border border-input bg-background px-2 py-1 text-xs leading-relaxed focus:outline-none focus:ring-1 focus:ring-primary"
              />
            ) : (
              <input
                ref={inputRef as React.RefObject<HTMLInputElement>}
                type={type}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder={placeholder}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    void save();
                  } else if (e.key === "Escape") {
                    e.preventDefault();
                    cancel();
                  }
                }}
                className="flex-1 min-w-0 rounded-sm border border-input bg-background px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
              />
            )}
            <div className="flex shrink-0 items-center gap-1">
              <button
                type="button"
                onClick={save}
                disabled={saving}
                title="Save (Enter)"
                aria-label="Save"
                className="inline-flex h-7 w-7 items-center justify-center rounded-sm border border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 disabled:opacity-50"
              >
                {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
              </button>
              <button
                type="button"
                onClick={cancel}
                disabled={saving}
                title="Cancel (Esc)"
                aria-label="Cancel"
                className="inline-flex h-7 w-7 items-center justify-center rounded-sm border border-red-300 bg-red-50 text-red-700 hover:bg-red-100 disabled:opacity-50"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </>
        ) : (
          <>
            <button
              type="button"
              disabled={!editable}
              onClick={() => editable && setEditing(true)}
              className={[
                "flex-1 min-w-0 text-left rounded-sm px-1 py-0.5 -mx-1",
                editable ? "cursor-text hover:bg-background/60" : "cursor-default",
              ].join(" ")}
              title={editable ? `Click to edit ${label.toLowerCase()}` : undefined}
            >
              <div className={pre ? "whitespace-pre-wrap break-words" : "break-words"}>
                {display
                  ? display(value)
                  : value !== null && value !== undefined && value !== ""
                    ? String(value)
                    : <span className="text-muted-foreground italic">{editable ? "Add…" : "—"}</span>}
              </div>
              {lastEdit && (
                <div
                  className="mt-0.5 text-[10px] text-muted-foreground"
                  title={`Last updated ${new Date(lastEdit.at).toLocaleString()}${lastEdit.actor ? ` by ${lastEdit.actor}` : ""}`}
                >
                  Updated {formatRelative(lastEdit.at)}
                  {lastEdit.actor ? ` · ${lastEdit.actor}` : ""}
                </div>
              )}
            </button>
            {editable && (
              <button
                type="button"
                onClick={() => setEditing(true)}
                title={`Edit ${label.toLowerCase()}`}
                aria-label={`Edit ${label}`}
                className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-sm text-muted-foreground opacity-60 hover:bg-muted hover:text-foreground focus:opacity-100 md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100"
              >
                <Pencil className="h-3 w-3" />
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}