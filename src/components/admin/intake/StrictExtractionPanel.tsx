import { useState } from "react";
import type { IntakeRecord } from "@/types/intake";
import { Button } from "@/components/ui/button";

interface Props {
  record: IntakeRecord;
}

/**
 * Surfaces the strict Gemini 2.5 Pro extraction output for reviewer trust:
 * - The five dedicated columns the extractor populates directly.
 * - The preserved raw strict JSON payload (extracted_sections_json.strict_extraction).
 *
 * Read-only by design. Values are populated by the extractor and re-run via the
 * existing "Re-run parse" / "Force reprocess" actions in the drawer. Missing /
 * unclear values stay null — the panel highlights nulls explicitly so dispatchers
 * can see what was NOT extracted rather than assuming silence == empty source.
 */
export function StrictExtractionPanel({ record }: Props) {
  const [showJson, setShowJson] = useState(false);
  const strict =
    (record.extracted_sections_json as { strict_extraction?: Record<string, unknown> } | null)
      ?.strict_extraction ?? null;

  const rows: Array<{ label: string; value: unknown; hint?: string }> = [
    { label: "Issue date", value: record.issue_date ?? null, hint: "YYYY-MM-DD" },
    {
      label: "Spend limit",
      value:
        record.spend_limit == null || record.spend_limit === ""
          ? null
          : `£${Number(record.spend_limit).toFixed(2)}`,
      hint: "Authorized cap only",
    },
    { label: "Completion deadline", value: record.completion_deadline ?? null, hint: "YYYY-MM-DD" },
    { label: "Agent email", value: record.agent_email ?? null, hint: "Issuing office" },
    { label: "Keys / access", value: record.keys_information ?? null },
  ];

  return (
    <section className="rounded-md border border-border bg-card">
      <div className="flex items-center justify-between border-b border-border px-3 py-2">
        <div className="text-[11px] uppercase tracking-wider text-muted-foreground">
          Strict extraction (Gemini 2.5 Pro)
        </div>
        <div className="text-[10px] text-muted-foreground">
          {strict ? "Raw JSON preserved" : "No strict payload"}
        </div>
      </div>
      <div className="grid gap-2 p-3 md:grid-cols-2">
        {rows.map((r) => (
          <div
            key={r.label}
            className="rounded-sm border border-border/60 bg-background/50 p-2"
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                {r.label}
              </span>
              {r.value == null ? (
                <span className="rounded-sm bg-muted px-1.5 py-0.5 text-[9px] uppercase tracking-wider text-muted-foreground">
                  Not extracted
                </span>
              ) : null}
            </div>
            <div
              className={
                r.value == null
                  ? "mt-1 text-xs italic text-muted-foreground"
                  : "mt-1 break-words text-xs text-foreground"
              }
            >
              {r.value == null ? "null" : String(r.value)}
            </div>
            {r.hint ? (
              <div className="mt-0.5 text-[10px] text-muted-foreground/70">{r.hint}</div>
            ) : null}
          </div>
        ))}
      </div>
      <div className="border-t border-border px-3 py-2">
        <div className="flex items-center justify-between">
          <div className="text-[11px] text-muted-foreground">
            Preserved strict JSON output (audit / debugging)
          </div>
          <Button
            size="sm"
            variant="ghost"
            className="h-6 text-[11px]"
            onClick={() => setShowJson((v) => !v)}
            disabled={!strict}
          >
            {showJson ? "Hide" : "Show"} JSON
          </Button>
        </div>
        {showJson && strict ? (
          <pre className="mt-2 max-h-80 overflow-auto rounded-sm border border-border bg-muted/40 p-2 font-mono text-[11px] leading-snug text-foreground">
            {JSON.stringify(strict, null, 2)}
          </pre>
        ) : null}
        {!strict ? (
          <div className="mt-1 text-[10px] text-muted-foreground/70">
            Run "Re-run parse" above to regenerate the strict extraction payload.
          </div>
        ) : null}
      </div>
    </section>
  );
}