import { useOriginalSourceUrl } from "@/hooks/useIntakeSources";
import type { IntakeRecord } from "@/types/intake";
import { FileText, FileImage, FileSpreadsheet, File as FileIcon, Paperclip, ExternalLink } from "lucide-react";

interface SourceAttachment {
  filename?: string;
  mimeType?: string;
  size?: number;
}

function fmtBytes(n?: number): string {
  if (!n || n <= 0) return "";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

function iconFor(mime?: string, filename?: string) {
  const m = (mime ?? "").toLowerCase();
  const f = (filename ?? "").toLowerCase();
  if (m.startsWith("image/")) return FileImage;
  if (m === "application/pdf" || f.endsWith(".pdf")) return FileText;
  if (m.includes("sheet") || /\.(xlsx?|csv)$/.test(f)) return FileSpreadsheet;
  if (m.includes("word") || /\.(docx?)$/.test(f)) return FileText;
  return FileIcon;
}

function shortLabel(mime?: string, filename?: string): string {
  const m = (mime ?? "").toLowerCase();
  if (m.startsWith("image/")) return m.split("/")[1]?.toUpperCase() || "IMG";
  if (m === "application/pdf") return "PDF";
  if (m.includes("sheet")) return "XLS";
  if (m.includes("word")) return "DOC";
  const ext = (filename ?? "").split(".").pop();
  return (ext || "FILE").toUpperCase().slice(0, 4);
}

/**
 * Compact attachment preview strip for intake review. Renders a tile per
 * source attachment with a type-appropriate icon, label, and size. For the
 * primary uploaded source file (stored in Supabase storage) it renders an
 * actual image thumbnail or PDF chip with an Open link.
 */
export function IntakeAttachmentPreviewStrip({ record }: { record: IntakeRecord }) {
  const payload = (record.raw_payload_json ?? {}) as { source_attachments?: SourceAttachment[] };
  const attachments = payload.source_attachments ?? [];
  const hasStoredFile = !!record.source_file_path;

  if (!hasStoredFile && attachments.length === 0) return null;

  return (
    <div className="rounded-md border border-border bg-card p-3">
      <div className="mb-2 flex items-center gap-2">
        <Paperclip className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Attachments
        </span>
        <span className="rounded-sm bg-muted px-1.5 py-0.5 text-[10px] font-medium tabular-nums text-muted-foreground">
          {attachments.length + (hasStoredFile ? 1 : 0)}
        </span>
      </div>

      <div className="flex flex-wrap gap-2">
        {hasStoredFile && <StoredSourceTile record={record} />}
        {attachments.map((a, i) => (
          <AttachmentTile key={`${a.filename ?? "att"}-${i}`} attachment={a} />
        ))}
      </div>
    </div>
  );
}

function AttachmentTile({ attachment }: { attachment: SourceAttachment }) {
  const Icon = iconFor(attachment.mimeType, attachment.filename);
  const label = shortLabel(attachment.mimeType, attachment.filename);
  return (
    <div
      className="flex w-[140px] flex-col gap-1 rounded-md border border-border bg-background p-2"
      title={`${attachment.filename ?? "(unnamed)"} · ${attachment.mimeType ?? "unknown"}`}
    >
      <div className="flex h-16 items-center justify-center rounded-sm bg-muted/50">
        <Icon className="h-7 w-7 text-muted-foreground" />
      </div>
      <div className="flex items-center justify-between gap-1">
        <span className="rounded-sm bg-muted px-1 text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">
          {label}
        </span>
        <span className="text-[10px] tabular-nums text-muted-foreground">
          {fmtBytes(attachment.size)}
        </span>
      </div>
      <div className="truncate text-[11px] font-medium text-foreground" title={attachment.filename}>
        {attachment.filename ?? "(unnamed)"}
      </div>
    </div>
  );
}

function StoredSourceTile({ record }: { record: IntakeRecord }) {
  const { data: url } = useOriginalSourceUrl(record);
  const mime = record.original_mime_type ?? "";
  const isImage = mime.startsWith("image/");
  const Icon = iconFor(mime, record.original_filename ?? undefined);
  const label = shortLabel(mime, record.original_filename ?? undefined);

  return (
    <div
      className="flex w-[140px] flex-col gap-1 rounded-md border border-primary/40 bg-background p-2 ring-1 ring-primary/20"
      title={record.original_filename ?? "Stored source file"}
    >
      <div className="relative flex h-16 items-center justify-center overflow-hidden rounded-sm bg-muted/50">
        {isImage && url ? (
          <img
            src={url}
            alt={record.original_filename ?? "source"}
            className="h-full w-full object-cover"
            loading="lazy"
          />
        ) : (
          <Icon className="h-7 w-7 text-muted-foreground" />
        )}
      </div>
      <div className="flex items-center justify-between gap-1">
        <span className="rounded-sm bg-primary/10 px-1 text-[9px] font-semibold uppercase tracking-wider text-primary">
          {label}
        </span>
        {url && (
          <a
            href={url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center text-[10px] text-muted-foreground hover:text-foreground"
            title="Open original source"
          >
            Open <ExternalLink className="ml-0.5 h-2.5 w-2.5" />
          </a>
        )}
      </div>
      <div className="truncate text-[11px] font-medium text-foreground">
        {record.original_filename ?? "Stored source"}
      </div>
    </div>
  );
}