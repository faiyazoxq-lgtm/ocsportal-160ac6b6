import { useRef, useState } from "react";
import { Camera, Check, AlertCircle, CloudOff, Loader2, X, Expand } from "lucide-react";
import { toast } from "sonner";
import {
  useEvidenceFiles,
  useSignedUrl,
  useUploadEvidence,
  type WorkOrderFile,
} from "@/hooks/useEvidenceFiles";
import { useOfflineStatus } from "@/hooks/useOfflineStatus";
import type { FileKind } from "@/services/evidenceUploads";

const KIND_META: Record<FileKind, { label: string; accept: string; capture?: "environment" | "user" }> = {
  arrival_photo: { label: "Arrival photo", accept: "image/*", capture: "environment" },
  before_leave_photo: { label: "Before-leaving photo", accept: "image/*", capture: "environment" },
  completion_signature: { label: "Customer signature", accept: "image/*", capture: "environment" },
  receipt_photo: { label: "Receipt photo", accept: "image/*", capture: "environment" },
  general_evidence: { label: "Evidence photo", accept: "image/*", capture: "environment" },
  source_pdf: { label: "Source document", accept: "application/pdf" },
};

export function EngineerEvidenceCapture({
  workOrderId,
  fileKind,
  required,
  disabled,
  helperText,
}: {
  workOrderId: string;
  fileKind: FileKind;
  required?: boolean;
  disabled?: boolean;
  helperText?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const { offline } = useOfflineStatus();
  const { data: files = [] } = useEvidenceFiles(workOrderId);
  const upload = useUploadEvidence(workOrderId);
  const meta = KIND_META[fileKind];

  const matches = files.filter((f) => f.file_kind === fileKind);
  const hasAny = matches.length > 0;

  const onPick = async (file: File) => {
    try {
      const res = await upload.mutateAsync({ fileKind, blob: file });
      if (res.queued) {
        toast.info("Saved offline", {
          description: `${meta.label} will upload when back online`,
        });
      } else {
        toast.success("Uploaded", { description: meta.label });
      }
    } catch (err) {
      toast.error("Upload failed", {
        description: err instanceof Error ? err.message : "Unknown error",
      });
    }
  };

  return (
    <div
      className={`rounded-md border bg-card p-3 ${
        hasAny
          ? "border-emerald-300/70"
          : required
            ? "border-dashed border-amber-300/70"
            : "border-dashed border-border"
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm font-medium text-foreground">
          <Camera className="h-4 w-4 text-muted-foreground" />
          {meta.label}
          {required ? (
            <span className="text-[10px] font-semibold uppercase tracking-wider text-amber-600">
              Required
            </span>
          ) : null}
        </div>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={disabled || upload.isPending}
          className="inline-flex items-center gap-1 rounded-sm border border-border bg-background px-2 py-1 text-xs font-medium hover:bg-accent disabled:cursor-not-allowed disabled:opacity-60"
        >
          {upload.isPending ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <Camera className="h-3 w-3" />
          )}
          {hasAny ? "Add another" : "Capture"}
        </button>
        <input
          ref={inputRef}
          type="file"
          accept={meta.accept}
          capture={meta.capture}
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void onPick(f);
            e.target.value = "";
          }}
        />
      </div>

      {helperText ? (
        <p className="mt-1 text-[10px] text-muted-foreground">{helperText}</p>
      ) : null}

      {offline ? (
        <p className="mt-2 inline-flex items-center gap-1 text-[10px] text-amber-700">
          <CloudOff className="h-3 w-3" />
          Offline — capture will be queued for upload
        </p>
      ) : null}

      {matches.length ? (
        <ul className="mt-3 grid grid-cols-4 gap-1.5">
          {matches.map((f) => (
            <EvidenceThumb key={f.id} file={f} />
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function EvidenceThumb({ file }: { file: WorkOrderFile }) {
  const [expanded, setExpanded] = useState(false);
  const isImage = (file.mime_type ?? "").startsWith("image/");
  const { data: thumbUrl } = useSignedUrl(
    isImage ? file.storage_bucket : null,
    isImage ? file.storage_path : null,
    200,
  );
  const { data: fullUrl } = useSignedUrl(
    isImage ? file.storage_bucket : null,
    isImage ? file.storage_path : null,
    1200,
  );
  return (
    <>
      <li
        className="group relative overflow-hidden rounded-sm border border-border bg-muted/40 cursor-pointer"
        onClick={() => isImage && setExpanded(true)}
        role="button"
        aria-label="Expand image"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") setExpanded(true);
        }}
      >
        <div className="aspect-square w-full">
          {isImage && thumbUrl ? (
            <img
              src={thumbUrl}
              alt={file.file_kind}
              className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-105"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-[10px] text-muted-foreground">
              {file.mime_type ?? "file"}
            </div>
          )}
        </div>
        {isImage && thumbUrl ? (
          <div className="absolute inset-0 flex items-center justify-center bg-black/0 transition-colors group-hover:bg-black/30">
            <Expand className="h-4 w-4 text-white opacity-0 transition-opacity group-hover:opacity-100" />
          </div>
        ) : null}
        <div className="absolute right-0.5 top-0.5 rounded-sm bg-background/90 px-1 py-0.5 text-[9px] font-semibold uppercase tracking-wider">
          {file.sync_status === "synced" ? (
            <span className="inline-flex items-center gap-0.5 text-emerald-700">
              <Check className="h-2.5 w-2.5" />
              Synced
            </span>
          ) : file.sync_status === "failed" ? (
            <span className="inline-flex items-center gap-0.5 text-destructive">
              <AlertCircle className="h-2.5 w-2.5" />
              Failed
            </span>
          ) : (
            <span className="inline-flex items-center gap-0.5 text-amber-700">
              <CloudOff className="h-2.5 w-2.5" />
              Pending
            </span>
          )}
        </div>
      </li>
      {expanded && fullUrl ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          onClick={() => setExpanded(false)}
          role="dialog"
          aria-modal="true"
        >
          <button
            type="button"
            onClick={() => setExpanded(false)}
            className="absolute right-3 top-3 rounded-full bg-black/60 p-2 text-white hover:bg-black/80"
            aria-label="Close image viewer"
          >
            <X className="h-5 w-5" />
          </button>
          <img
            src={fullUrl}
            alt={file.file_kind}
            className="max-h-[90vh] max-w-[90vw] rounded-md object-contain shadow-lg"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      ) : null}
    </>
  );
}

export function EvidenceSummaryBadge({
  workOrderId,
}: {
  workOrderId: string;
}) {
  const { data: files = [] } = useEvidenceFiles(workOrderId);
  if (!files.length) {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
        <X className="h-3 w-3" />
        No evidence yet
      </span>
    );
  }
  const byKind = files.reduce<Record<string, number>>((acc, f) => {
    acc[f.file_kind] = (acc[f.file_kind] ?? 0) + 1;
    return acc;
  }, {});
  return (
    <div className="flex flex-wrap gap-1 text-[10px]">
      {Object.entries(byKind).map(([k, n]) => (
        <span
          key={k}
          className="rounded-sm border border-border bg-muted/40 px-1.5 py-0.5"
        >
          {k.replace(/_/g, " ")} · {n}
        </span>
      ))}
    </div>
  );
}