import type { IntakeRecord } from "@/types/intake";
import { Mail, Paperclip, Sparkles, Layers, FileText, LifeBuoy, RotateCw } from "lucide-react";

interface SourceAttachment {
  filename?: string;
  mimeType?: string;
  size?: number;
}

interface EmailExtractionPayload {
  gmail_message_id?: string;
  gmail_thread_id?: string;
  ai_summary?: string | null;
  ai_scanned_attachments?: number;
  work_order_index?: number | null;
  work_orders_total?: number;
  source_attachments?: SourceAttachment[];
  recovered?: boolean;
  recovered_at?: string | null;
  reanalyzed?: boolean;
  reanalyzed_at?: string | null;
}

function formatBytes(n?: number): string {
  if (!n || n <= 0) return "—";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

/**
 * Renders the AI extraction context for intake records sourced from Gmail:
 * AI summary, scanned-attachment count, multi-work-order position, and the
 * list of source attachments (preserved for dispatcher verification).
 */
export function EmailExtractionPanel({ record }: { record: IntakeRecord }) {
  const payload = (record.raw_payload_json ?? {}) as EmailExtractionPayload;
  if (!payload.gmail_message_id) return null;

  const total = payload.work_orders_total ?? 1;
  const idx = payload.work_order_index ?? null;
  const attachments = payload.source_attachments ?? [];

  return (
    <div className="rounded-md border border-border bg-card p-3 text-sm">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <Mail className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Email extraction
        </span>
        {payload.recovered && (
          <span
            className="inline-flex items-center gap-1 rounded-sm bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-800 dark:bg-amber-900/30 dark:text-amber-200"
            title={payload.recovered_at ? `Recovered ${new Date(payload.recovered_at).toLocaleString()}` : undefined}
          >
            <LifeBuoy className="h-3 w-3" />
            Recovered from missed email
          </span>
        )}
        {payload.reanalyzed && (
          <span
            className="inline-flex items-center gap-1 rounded-sm bg-sky-50 px-1.5 py-0.5 text-[10px] font-medium text-sky-800 dark:bg-sky-900/30 dark:text-sky-200"
            title={payload.reanalyzed_at ? `Re-analyzed ${new Date(payload.reanalyzed_at).toLocaleString()}` : undefined}
          >
            <RotateCw className="h-3 w-3" />
            Re-analyzed by sync
          </span>
        )}
        {record.ocr_used && (
          <span className="inline-flex items-center gap-1 rounded-sm bg-emerald-50 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-200">
            <Sparkles className="h-3 w-3" />
            Attachment text extracted
          </span>
        )}
        {total > 1 && idx != null && (
          <span className="inline-flex items-center gap-1 rounded-sm bg-indigo-50 px-1.5 py-0.5 text-[10px] font-medium text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-200">
            <Layers className="h-3 w-3" />
            Job {idx} of {total}
          </span>
        )}
        {typeof payload.ai_scanned_attachments === "number" && payload.ai_scanned_attachments > 0 && (
          <span className="inline-flex items-center gap-1 rounded-sm bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
            <Paperclip className="h-3 w-3" />
            {payload.ai_scanned_attachments} scanned by AI
          </span>
        )}
      </div>

      {payload.ai_summary && (
        <div className="mb-2 rounded-sm border border-border bg-muted/30 p-2 text-xs text-foreground">
          <span className="font-semibold">AI summary:</span> {payload.ai_summary}
        </div>
      )}

      {total > 1 && (
        <div className="mb-2 text-[11px] text-muted-foreground">
          This intake is part of a multi-job email. {total} candidate work orders were detected
          from one inbound email — each was added to the intake queue for dispatcher/boss to
          verify time and quotation before dispatch.
        </div>
      )}

      {attachments.length > 0 && (
        <div>
          <div className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Source attachments ({attachments.length})
          </div>
          <ul className="space-y-1">
            {attachments.map((a, i) => (
              <li
                key={`${a.filename ?? "att"}-${i}`}
                className="flex items-center gap-2 truncate rounded-sm border border-border bg-background px-2 py-1 text-[11px]"
              >
                <FileText className="h-3 w-3 shrink-0 text-muted-foreground" />
                <span className="truncate font-mono">{a.filename ?? "(unnamed)"}</span>
                <span className="ml-auto shrink-0 text-muted-foreground">
                  {a.mimeType ?? "—"} · {formatBytes(a.size)}
                </span>
              </li>
            ))}
          </ul>
          <div className="mt-1 text-[10px] text-muted-foreground">
            Originals are preserved in Gmail under the configured processed-emails label.
          </div>
        </div>
      )}
    </div>
  );
}