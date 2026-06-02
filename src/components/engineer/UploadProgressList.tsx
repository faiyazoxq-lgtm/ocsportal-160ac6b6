import { Check, AlertCircle, CloudOff, Loader2, X, Image as ImageIcon } from "lucide-react";
import type { UploadJob } from "@/hooks/useEvidenceFiles";

function stageLabel(job: UploadJob): string {
  switch (job.stage) {
    case "compressing":
      return "Optimising image…";
    case "uploading": {
      const pct =
        job.total > 0 ? Math.min(100, Math.round((job.loaded / job.total) * 100)) : 0;
      return `Uploading… ${pct}%`;
    }
    case "saving":
      return "Finalising…";
    case "done":
      return "Uploaded";
    case "queued":
      return job.error ? `Queued — will retry (${job.error})` : "Saved offline — will sync";
    case "error":
      return job.error ?? "Upload failed";
    default:
      return "Working…";
  }
}

function formatBytes(n: number): string {
  if (!n) return "0 KB";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

export function UploadProgressList({
  uploads,
  onDismiss,
}: {
  uploads: UploadJob[];
  onDismiss: (id: string) => void;
}) {
  if (!uploads.length) return null;
  return (
    <ul className="mt-2 space-y-1.5">
      {uploads.map((job) => {
        const pct =
          job.stage === "done"
            ? 100
            : job.total > 0
              ? Math.min(100, Math.round((job.loaded / job.total) * 100))
              : 0;
        const tone =
          job.stage === "error"
            ? "border-destructive/40 bg-destructive/5"
            : job.stage === "queued"
              ? "border-amber-300/60 bg-amber-50/60"
              : job.stage === "done"
                ? "border-emerald-300/60 bg-emerald-50/40"
                : "border-border bg-card";
        return (
          <li
            key={job.id}
            className={`rounded-md border px-2.5 py-1.5 text-[11px] ${tone}`}
          >
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">
                {job.stage === "done" ? (
                  <Check className="h-3.5 w-3.5 text-emerald-600" />
                ) : job.stage === "error" ? (
                  <AlertCircle className="h-3.5 w-3.5 text-destructive" />
                ) : job.stage === "queued" ? (
                  <CloudOff className="h-3.5 w-3.5 text-amber-600" />
                ) : job.stage === "compressing" ? (
                  <ImageIcon className="h-3.5 w-3.5 animate-pulse" />
                ) : (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                )}
              </span>
              <span className="min-w-0 flex-1 truncate font-medium text-foreground">
                {job.name}
              </span>
              <span className="shrink-0 text-muted-foreground">
                {formatBytes(job.total || job.size)}
              </span>
              <button
                type="button"
                onClick={() => onDismiss(job.id)}
                className="rounded-sm p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                aria-label="Dismiss"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
            <div className="mt-1 flex items-center gap-2">
              <div className="h-1 flex-1 overflow-hidden rounded-full bg-muted">
                <div
                  className={`h-full transition-all duration-200 ${
                    job.stage === "error"
                      ? "bg-destructive"
                      : job.stage === "queued"
                        ? "bg-amber-500"
                        : job.stage === "done"
                          ? "bg-emerald-500"
                          : "bg-primary"
                  }`}
                  style={{
                    width:
                      job.stage === "compressing"
                        ? "15%"
                        : job.stage === "saving"
                          ? "95%"
                          : `${pct}%`,
                  }}
                />
              </div>
              <span className="shrink-0 text-[10px] text-muted-foreground">
                {stageLabel(job)}
              </span>
            </div>
          </li>
        );
      })}
    </ul>
  );
}