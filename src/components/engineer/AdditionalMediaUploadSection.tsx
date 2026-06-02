import { useRef } from "react";
import {
  FileImage,
  FileVideo,
  FileText,
  Upload,
  Loader2,
  CloudOff,
  Check,
  AlertCircle,
  Paperclip,
} from "lucide-react";
import { toast } from "sonner";
import {
  useEvidenceFiles,
  useSignedUrl,
  useUploadEvidence,
  type WorkOrderFile,
} from "@/hooks/useEvidenceFiles";
import { useOfflineStatus } from "@/hooks/useOfflineStatus";

const ACCEPT =
  "image/*,video/*,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/plain,text/csv";

/**
 * Engineer-side "Additional documents and media" uploader. Accepts images,
 * videos, and documents. Uses the general_evidence kind so files land in
 * the work-order-evidence bucket, where the existing RLS policy already
 * grants the lead engineer write access.
 */
export function AdditionalMediaUploadSection({
  workOrderId,
  canUpload,
}: {
  workOrderId: string;
  canUpload: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLInputElement>(null);
  const { offline } = useOfflineStatus();
  const { data: files = [] } = useEvidenceFiles(workOrderId);
  const upload = useUploadEvidence(workOrderId);

  const additional = files.filter(
    (f) =>
      f.file_kind === "general_evidence" ||
      f.file_kind === "source_pdf",
  );

  const pickFiles = async (list: FileList | null) => {
    if (!list || list.length === 0) return;
    for (const file of Array.from(list)) {
      try {
        const res = await upload.mutateAsync({
          fileKind: "general_evidence",
          blob: file,
        });
        toast.success(res.queued ? "Saved offline" : "Uploaded", {
          description: file.name,
        });
      } catch (err) {
        toast.error("Upload failed", {
          description: err instanceof Error ? err.message : file.name,
        });
      }
    }
  };

  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between px-1">
        <div>
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Additional documents and media
          </h2>
          <p className="text-[11px] text-muted-foreground">
            Photos, videos, PDFs and documents. Upload anything that helps explain the job.
          </p>
        </div>
      </div>

      {canUpload ? (
        <div className="rounded-md border-2 border-dashed border-primary/30 bg-primary/5 p-3">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            <UploadButton
              icon={<FileImage className="h-5 w-5" />}
              label="Add photo"
              onClick={() => cameraRef.current?.click()}
              pending={upload.isPending}
            />
            <UploadButton
              icon={<FileVideo className="h-5 w-5" />}
              label="Add video"
              onClick={() => videoRef.current?.click()}
              pending={upload.isPending}
            />
            <UploadButton
              icon={<FileText className="h-5 w-5" />}
              label="Add document"
              onClick={() => inputRef.current?.click()}
              pending={upload.isPending}
            />
          </div>

          <input
            ref={cameraRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => {
              void pickFiles(e.target.files);
              e.target.value = "";
            }}
          />
          <input
            ref={videoRef}
            type="file"
            accept="video/*"
            multiple
            className="hidden"
            onChange={(e) => {
              void pickFiles(e.target.files);
              e.target.value = "";
            }}
          />
          <input
            ref={inputRef}
            type="file"
            accept={ACCEPT}
            multiple
            className="hidden"
            onChange={(e) => {
              void pickFiles(e.target.files);
              e.target.value = "";
            }}
          />

          {offline ? (
            <p className="mt-2 inline-flex items-center gap-1 text-[10px] text-amber-700">
              <CloudOff className="h-3 w-3" />
              Offline — uploads will queue and sync when back online
            </p>
          ) : null}
        </div>
      ) : (
        <div className="rounded-md border border-dashed border-border bg-muted/30 p-3 text-xs text-muted-foreground">
          Only the lead engineer can upload additional media for this job.
        </div>
      )}

      {additional.length ? (
        <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {additional.map((f) => (
            <MediaThumb key={f.id} file={f} />
          ))}
        </ul>
      ) : (
        <div className="rounded-md border border-dashed border-border bg-card p-3 text-center text-[11px] text-muted-foreground">
          No additional documents or media yet.
        </div>
      )}
    </section>
  );
}

function UploadButton({
  icon,
  label,
  onClick,
  pending,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  pending: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={pending}
      className="flex min-h-[60px] flex-col items-center justify-center gap-1 rounded-md border border-border bg-background px-3 py-2 text-xs font-semibold text-foreground transition hover:bg-accent/40 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
    >
      {pending ? <Loader2 className="h-5 w-5 animate-spin" /> : icon}
      <span>{label}</span>
    </button>
  );
}

function MediaThumb({ file }: { file: WorkOrderFile }) {
  const mime = file.mime_type ?? "";
  const isImage = mime.startsWith("image/");
  const isVideo = mime.startsWith("video/");
  const { data: url } = useSignedUrl(
    isImage || isVideo ? file.storage_bucket : null,
    isImage || isVideo ? file.storage_path : null,
    600,
  );
  const name = file.storage_path.split("/").pop() ?? "file";

  return (
    <li className="relative overflow-hidden rounded-sm border border-border bg-muted/40">
      <div className="aspect-square w-full">
        {isImage && url ? (
          <img src={url} alt={name} className="h-full w-full object-cover" />
        ) : isVideo && url ? (
          <video src={url} className="h-full w-full object-cover" controls preload="metadata" />
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center gap-1 p-2 text-[10px] text-muted-foreground">
            <Paperclip className="h-5 w-5" />
            <span className="truncate">{name}</span>
          </div>
        )}
      </div>
      <div className="absolute right-1 top-1 rounded-sm bg-background/90 px-1 py-0.5 text-[9px] font-semibold uppercase tracking-wider">
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
            <Upload className="h-2.5 w-2.5" />
            Pending
          </span>
        )}
      </div>
    </li>
  );
}