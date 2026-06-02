import { useRef, useState } from "react";
import { Camera, Upload, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { uploadEvidence, type UploadStage } from "@/services/evidenceUploads";
import { useCurrentEngineer } from "@/hooks/useEngineerJobs";

/**
 * Mobile-friendly receipt/file upload. Accepts images (camera capture on
 * supported devices), PDFs and common docs. Uploads via the existing
 * `receipt_photo` evidence pipeline and surfaces the new file id so the
 * caller can attach + trigger extraction.
 */
export function ExpenseReceiptUpload({
  workOrderId,
  onUploaded,
  busy,
}: {
  workOrderId: string;
  onUploaded: (fileId: string) => void;
  busy?: boolean;
}) {
  const cameraRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const { data: me } = useCurrentEngineer();
  const [uploading, setUploading] = useState(false);
  const [stage, setStage] = useState<UploadStage | null>(null);
  const [progress, setProgress] = useState(0);
  const [fileName, setFileName] = useState<string | null>(null);

  const handleFiles = async (files: FileList | null) => {
    const f = files?.[0];
    if (!f) return;
    setUploading(true);
    setStage("compressing");
    setProgress(0);
    setFileName(f.name);
    try {
      const res = await uploadEvidence(
        {
          workOrderId,
          engineerId: me?.id ?? null,
          fileKind: "receipt_photo",
          blob: f,
        },
        {
          onStage: (s) => setStage(s),
          onProgress: (loaded, total) =>
            setProgress(total > 0 ? Math.round((loaded / total) * 100) : 0),
        },
      );
      onUploaded(res.id);
    } catch (e) {
      setStage("error");
      toast.error("Upload failed", { description: (e as Error).message });
    } finally {
      setUploading(false);
      setTimeout(() => {
        setStage(null);
        setProgress(0);
        setFileName(null);
      }, 1500);
    }
  };

  const disabled = uploading || busy;

  const stageLabel =
    stage === "compressing"
      ? "Optimising image…"
      : stage === "uploading"
        ? `Uploading… ${progress}%`
        : stage === "saving"
          ? "Finalising…"
          : stage === "done"
            ? "Uploaded"
            : stage === "error"
              ? "Upload failed"
              : "";

  return (
    <div className="space-y-1">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        Receipt / supporting file
      </div>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={disabled}
          onClick={() => cameraRef.current?.click()}
          className="inline-flex items-center gap-1.5 rounded-sm border border-border bg-background px-3 py-1.5 text-xs font-medium hover:bg-muted disabled:opacity-60"
        >
          {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Camera className="h-3.5 w-3.5" />}
          Take photo
        </button>
        <button
          type="button"
          disabled={disabled}
          onClick={() => fileRef.current?.click()}
          className="inline-flex items-center gap-1.5 rounded-sm border border-border bg-background px-3 py-1.5 text-xs font-medium hover:bg-muted disabled:opacity-60"
        >
          {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
          Upload file
        </button>
        <input
          ref={cameraRef}
          type="file"
          accept="image/*"
          capture="environment"
          hidden
          onChange={(e) => handleFiles(e.target.files)}
        />
        <input
          ref={fileRef}
          type="file"
          accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx,.txt,.csv,.heic"
          hidden
          onChange={(e) => handleFiles(e.target.files)}
        />
      </div>
      <p className="text-[10px] text-muted-foreground">
        Image, PDF or document. We'll try to read merchant, items, total, date, time, receipt
        number and payment method automatically.
      </p>
    </div>
  );
}