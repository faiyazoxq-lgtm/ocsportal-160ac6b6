import { useState } from "react";
import { ChevronDown, ChevronUp, FileText, Package } from "lucide-react";
import type { ExtractedItem } from "@/types/expenses";

/**
 * Shows the raw text the extractor pulled off the receipt, collapsed by
 * default. Surfaces visible content even when structured extraction is
 * weak — never blocks the user.
 */
export function ReceiptExtractionPreview({
  rawText,
  items,
}: {
  rawText: string;
  items?: ExtractedItem[] | null;
}) {
  const [open, setOpen] = useState(false);
  const namedItems = (items ?? []).filter((it) => it && it.name);
  if (!rawText && namedItems.length === 0) return null;
  return (
    <div className="space-y-2">
      {namedItems.length > 0 ? (
        <div className="rounded-sm border border-primary/30 bg-primary/5 p-2 text-[11px]">
          <div className="mb-1 inline-flex items-center gap-1.5 font-semibold uppercase tracking-wider text-foreground">
            <Package className="h-3 w-3 text-primary" />
            Parts detected ({namedItems.length})
          </div>
          <ul className="divide-y divide-border/60">
            {namedItems.map((it, i) => {
              const price = it.line_total ?? it.unit_price;
              return (
                <li key={i} className="flex items-start justify-between gap-2 py-1">
                  <span className="min-w-0 flex-1 truncate text-foreground">
                    {it.quantity ? `${it.quantity}× ` : ""}
                    {it.name}
                  </span>
                  <span className="font-mono tabular-nums text-foreground">
                    {price != null ? `£${price.toFixed(2)}` : "—"}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
      {rawText ? (
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
      ) : null}
    </div>
  );
}