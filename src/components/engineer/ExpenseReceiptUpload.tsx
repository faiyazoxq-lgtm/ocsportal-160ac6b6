import { useRef, useState } from "react";
import { Camera, Upload, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { uploadEvidence } from "@/services/evidenceUploads";
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

  const handleFiles = async (files: FileList | null) => {
    const f = files?.[0];
    if (!f) return;
    setUploading(true);
    try {
      const res = await uploadEvidence({
        workOrderId,
        engineerId: me?.id ?? null,
        fileKind: "receipt_photo",
        blob: f,
      });
      onUploaded(res.id);
    } catch (e) {
      toast.error("Upload failed", { description: (e as Error).message });
    } finally {
      setUploading(false);
    }
  };

  const disabled = uploading || busy;

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