import { useEffect, useRef, useState } from "react";
import { Pencil, Check, X } from "lucide-react";
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
};

export function InlineEditableField({
  label,
  value,
  onSave,
  type = "text",
  pre,
  placeholder,
  display,
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

  return (
    <div className="grid grid-cols-[140px_1fr] items-start gap-2 text-xs">
      <div className="text-muted-foreground">{label}</div>
      <div className="flex items-start gap-1">
        {editing ? (
          <>
            {type === "textarea" ? (
              <textarea
                ref={inputRef as React.RefObject<HTMLTextAreaElement>}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder={placeholder}
                rows={3}
                className="flex-1 rounded-sm border border-input bg-background px-2 py-1 text-xs"
              />
            ) : (
              <input
                ref={inputRef as React.RefObject<HTMLInputElement>}
                type={type}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder={placeholder}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && type !== "textarea") {
                    e.preventDefault();
                    void save();
                  } else if (e.key === "Escape") {
                    e.preventDefault();
                    cancel();
                  }
                }}
                className="flex-1 rounded-sm border border-input bg-background px-2 py-1 text-xs"
              />
            )}
            <button
              type="button"
              onClick={save}
              disabled={saving}
              title="Save"
              className="rounded-sm border border-emerald-300 bg-emerald-50 p-1 text-emerald-700 hover:bg-emerald-100 disabled:opacity-50"
            >
              <Check className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={cancel}
              disabled={saving}
              title="Cancel"
              className="rounded-sm border border-red-300 bg-red-50 p-1 text-red-700 hover:bg-red-100 disabled:opacity-50"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </>
        ) : (
          <>
            <div className={`flex-1 ${pre ? "whitespace-pre-wrap" : ""}`}>
              {display
                ? display(value)
                : value !== null && value !== undefined && value !== ""
                  ? String(value)
                  : <span className="text-muted-foreground">—</span>}
            </div>
            {onSave && (
              <button
                type="button"
                onClick={() => setEditing(true)}
                title={`Edit ${label.toLowerCase()}`}
                className="rounded-sm p-1 text-muted-foreground opacity-60 hover:bg-muted hover:opacity-100"
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