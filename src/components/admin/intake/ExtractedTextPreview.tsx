import { useState } from "react";
import { ChevronDown, ChevronRight, FileText } from "lucide-react";

export function ExtractedTextPreview({ text }: { text: string | null }) {
  const [open, setOpen] = useState(false);
  if (!text || text.trim().length === 0) return null;
  const lineCount = text.split("\n").length;
  return (
    <div className="rounded-md border border-border bg-card">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-3 py-2 text-left text-xs font-medium hover:bg-accent/40"
      >
        <span className="inline-flex items-center gap-2 text-muted-foreground">
          {open ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
          <FileText className="h-3.5 w-3.5" />
          Extracted text preview
        </span>
        <span className="text-[10px] text-muted-foreground">
          {text.length.toLocaleString()} chars · {lineCount} lines
        </span>
      </button>
      {open && (
        <pre className="max-h-[280px] overflow-auto whitespace-pre-wrap border-t border-border bg-muted/30 px-3 py-2 text-[11px] leading-relaxed text-foreground">
          {text}
        </pre>
      )}
    </div>
  );
}