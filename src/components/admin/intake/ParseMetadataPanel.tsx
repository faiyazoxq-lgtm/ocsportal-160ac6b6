import type { IntakeRecord } from "@/types/intake";
import { ScanText, Sparkles, FileText, Mail, Webhook, PencilLine, AlertTriangle } from "lucide-react";

const METHOD_META: Record<string, { label: string; Icon: typeof Mail }> = {
  email_text: { label: "Email text", Icon: Mail },
  webhook_json: { label: "Webhook JSON", Icon: Webhook },
  pdf_ocr: { label: "PDF (OCR)", Icon: ScanText },
  image_ocr: { label: "Image (OCR)", Icon: ScanText },
  manual_text: { label: "Manual text", Icon: PencilLine },
  empty: { label: "No content", Icon: FileText },
  gmail_ai_extract: { label: "Gmail + AI vision", Icon: Sparkles },
};

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[110px_1fr] gap-2 text-xs">
      <div className="text-muted-foreground">{label}</div>
      <div className="truncate text-foreground">{value ?? <span className="text-muted-foreground">—</span>}</div>
    </div>
  );
}

export function ParseMetadataPanel({ record }: { record: IntakeRecord }) {
  const m = record.parse_method ? METHOD_META[record.parse_method] : null;
  const Icon = m?.Icon ?? Sparkles;

  const started = record.parsing_started_at ? new Date(record.parsing_started_at) : null;
  const completed = record.parsing_completed_at ? new Date(record.parsing_completed_at) : null;
  const durationMs =
    started && completed ? Math.max(0, completed.getTime() - started.getTime()) : null;

  return (
    <div className="rounded-md border border-border bg-card p-3">
      <div className="mb-2 flex items-center justify-between">
        <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Parse metadata
        </div>
        <span className="inline-flex items-center gap-1 rounded-sm bg-muted px-1.5 py-0.5 text-[10px] font-medium">
          <Icon className="h-3 w-3" />
          {m?.label ?? record.parse_method ?? "not parsed"}
        </span>
      </div>
      <div className="space-y-1.5">
        <Row label="Method" value={m?.label ?? record.parse_method} />
        <Row label="OCR used" value={record.ocr_used ? "Yes" : "No"} />
        <Row label="Parser" value={record.parser_version} />
        <Row label="Started" value={started ? started.toLocaleString() : null} />
        <Row label="Completed" value={completed ? completed.toLocaleString() : null} />
        <Row label="Duration" value={durationMs != null ? `${(durationMs / 1000).toFixed(1)}s` : null} />
        <Row label="Capture" value={record.capture_status} />
      </div>
      {record.parse_error && (
        <div className="mt-2 flex items-start gap-2 rounded-sm border border-red-200 bg-red-50 p-2 text-[11px] text-red-900 dark:border-red-900/40 dark:bg-red-900/20 dark:text-red-200">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <div>
            <div className="font-semibold">Parse failed</div>
            <div className="break-words">{record.parse_error}</div>
          </div>
        </div>
      )}
    </div>
  );
}