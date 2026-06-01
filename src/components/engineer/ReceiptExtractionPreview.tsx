import { useState } from "react";
import { ChevronDown, ChevronUp, FileText } from "lucide-react";

/**
 * Shows the raw text the extractor pulled off the receipt, collapsed by
 * default. Surfaces visible content even when structured extraction is
 * weak — never blocks the user.
 */
export function ReceiptExtractionPreview({ rawText }: { rawText: string }) {
  const [open, setOpen] = useState(false);
  if (!rawText) return null;
  return (
    <div className="rounded-sm border border-border bg-muted/30 p-2 text-[11px]">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1.5 font-semibold uppercase tracking-wider text-muted-foreground"
      >
        <FileText className="h-3 w-3" />
        Receipt OCR / extracted text
        {open ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
      </button>
      {open ? (
        <pre className="mt-1 max-h-48 overflow-auto whitespace-pre-wrap text-foreground">
          {rawText}
        </pre>
      ) : null}
    </div>
  );
}