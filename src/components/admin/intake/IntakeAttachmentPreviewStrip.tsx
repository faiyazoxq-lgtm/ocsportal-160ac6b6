import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useOriginalSourceUrl } from "@/hooks/useIntakeSources";
import type { IntakeRecord } from "@/types/intake";
import { fetchIntakeGmailAttachment } from "@/lib/gmail.functions";
import { toast } from "sonner";
import {
  FileText,
  FileImage,
  FileSpreadsheet,
  File as FileIcon,
  Paperclip,
  ExternalLink,
  Loader2,
} from "lucide-react";

interface SourceAttachment {
  filename?: string;
  mimeType?: string;
  size?: number;
  attachmentId?: string;
}

function base64ToBlob(base64: string, mimeType: string): Blob {
  const clean = base64.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(clean);
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: mimeType || "application/octet-stream" });
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
          <AttachmentTile
            key={`${a.filename ?? "att"}-${i}`}
            attachment={a}
            intakeId={record.id}
          />
        ))}
      </div>
    </div>
  );
}

function AttachmentTile({
  attachment,
  intakeId,
}: {
  attachment: SourceAttachment;
  intakeId: string;
}) {
  const Icon = iconFor(attachment.mimeType, attachment.filename);
  const label = shortLabel(attachment.mimeType, attachment.filename);
  const filename = attachment.filename ?? "";
  const mime = (attachment.mimeType ?? "").toLowerCase();
  const isImage = mime.startsWith("image/");
  const isPdf = mime === "application/pdf" || filename.toLowerCase().endsWith(".pdf");
  const size = attachment.size ?? 0;

  const fetchFn = useServerFn(fetchIntakeGmailAttachment);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);

  // Auto-load thumbnail for small images.
  const AUTO_LOAD_MAX = 2 * 1024 * 1024; // 2MB
  const shouldAutoLoad = isImage && filename && (size === 0 || size <= AUTO_LOAD_MAX);

  async function ensureLoaded(): Promise<string | null> {
    if (blobUrl) return blobUrl;
    if (!filename) return null;
    setLoading(true);
    try {
      const res = await fetchFn({ data: { intakeId, filename } });
      const blob = base64ToBlob(res.base64, res.mimeType || mime || "application/octet-stream");
      const url = URL.createObjectURL(blob);
      setBlobUrl(url);
      return url;
    } catch (e) {
      setFailed(true);
      toast.error(e instanceof Error ? e.message : "Couldn't load attachment");
      return null;
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (shouldAutoLoad && !blobUrl && !loading && !failed) {
      void ensureLoaded();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shouldAutoLoad]);

  useEffect(() => {
    return () => {
      if (blobUrl) URL.revokeObjectURL(blobUrl);
    };
  }, [blobUrl]);

  async function handleOpen(e: React.MouseEvent) {
    e.preventDefault();
    const url = await ensureLoaded();
    if (url) window.open(url, "_blank", "noopener,noreferrer");
  }

  return (
    <div
      className="flex w-[140px] flex-col gap-1 rounded-md border border-border bg-background p-2"
      title={`${filename || "(unnamed)"} · ${attachment.mimeType ?? "unknown"}`}
    >
      <button
        type="button"
        onClick={handleOpen}
        disabled={loading || !filename}
        className="relative flex h-16 items-center justify-center overflow-hidden rounded-sm bg-muted/50 transition hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60"
        aria-label={`Open ${filename || "attachment"}`}
      >
        {isImage && blobUrl ? (
          <img
            src={blobUrl}
            alt={filename || "attachment"}
            className="h-full w-full object-cover"
            loading="lazy"
          />
        ) : loading ? (
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        ) : isPdf ? (
          <div className="flex flex-col items-center gap-0.5">
            <FileText className="h-6 w-6 text-muted-foreground" />
            <span className="text-[9px] font-semibold tracking-wider text-muted-foreground">PDF</span>
          </div>
        ) : (
          <Icon className="h-7 w-7 text-muted-foreground" />
        )}
      </button>
      <div className="flex items-center justify-between gap-1">
        <span className="rounded-sm bg-muted px-1 text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">
          {label}
        </span>
        <span className="text-[10px] tabular-nums text-muted-foreground">
          {fmtBytes(attachment.size)}
        </span>
      </div>
      <div className="truncate text-[11px] font-medium text-foreground" title={filename}>
        {filename || "(unnamed)"}
      </div>
      <button
        type="button"
        onClick={handleOpen}
        disabled={loading || !filename}
        className="mt-0.5 inline-flex items-center justify-center gap-1 rounded-sm bg-muted/60 px-1.5 py-0.5 text-[10px] font-medium text-foreground hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60"
      >
        {loading ? (
          <>
            <Loader2 className="h-2.5 w-2.5 animate-spin" /> Loading…
          </>
        ) : failed ? (
          "Retry"
        ) : (
          <>
            Open <ExternalLink className="h-2.5 w-2.5" />
          </>
        )}
      </button>
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