import type { IntakeRecord } from "@/types/intake";
import { IntakeChannelBadge } from "./IntakeChannelBadge";

function fmtBytes(n: number | null | undefined) {
  if (!n && n !== 0) return null;
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[110px_1fr] gap-2 text-xs">
      <div className="text-muted-foreground">{label}</div>
      <div className="truncate text-foreground">{value ?? <span className="text-muted-foreground">—</span>}</div>
    </div>
  );
}

export function SourceMetadataPanel({ record }: { record: IntakeRecord }) {
  const size = fmtBytes(record.original_byte_size);
  return (
    <div className="rounded-md border border-border bg-card p-3">
      <div className="mb-2 flex items-center justify-between">
        <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Source metadata
        </div>
        <IntakeChannelBadge source={record.source_type} />
      </div>
      <div className="space-y-1.5">
        <Row label="Sender" value={record.source_sender} />
        <Row label="Subject" value={record.source_subject} />
        <Row label="Reference" value={record.source_reference} />
        <Row label="Received" value={new Date(record.received_at ?? record.created_at).toLocaleString()} />
        <Row label="Capture" value={record.capture_status} />
        <Row
          label="Original file"
          value={
            record.original_filename
              ? `${record.original_filename}${size ? ` · ${size}` : ""}${record.original_mime_type ? ` · ${record.original_mime_type}` : ""}`
              : null
          }
        />
        <Row label="Storage path" value={record.source_file_path} />
      </div>
    </div>
  );
}