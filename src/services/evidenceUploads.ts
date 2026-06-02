import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type FileKind = Database["public"]["Enums"]["file_kind"];

export const FILE_KIND_BUCKETS: Record<FileKind, string> = {
  source_pdf: "work-order-source-docs",
  arrival_photo: "work-order-evidence",
  before_leave_photo: "work-order-evidence",
  completion_signature: "work-order-signatures",
  receipt_photo: "work-order-receipts",
  general_evidence: "work-order-evidence",
};

function extFromMime(mime: string): string {
  if (mime.includes("png")) return "png";
  if (mime.includes("webp")) return "webp";
  if (mime.includes("jpeg") || mime.includes("jpg")) return "jpg";
  if (mime.includes("gif")) return "gif";
  if (mime.includes("heic")) return "heic";
  if (mime.includes("pdf")) return "pdf";
  if (mime.includes("svg")) return "svg";
  if (mime === "video/mp4" || mime.includes("mp4")) return "mp4";
  if (mime.includes("quicktime")) return "mov";
  if (mime.includes("webm")) return "webm";
  if (mime === "video/3gpp" || mime.includes("3gpp")) return "3gp";
  if (mime.includes("msword")) return "doc";
  if (mime.includes("officedocument.wordprocessingml")) return "docx";
  if (mime.includes("officedocument.spreadsheetml")) return "xlsx";
  if (mime.includes("ms-excel")) return "xls";
  if (mime === "text/plain") return "txt";
  if (mime === "text/csv") return "csv";
  return "bin";
}

export interface UploadEvidenceInput {
  workOrderId: string;
  engineerId: string | null;
  fileKind: FileKind;
  blob: Blob;
  uploadedOffline?: boolean;
  metadata?: Record<string, unknown>;
}

export interface UploadedEvidence {
  id: string;
  storage_bucket: string;
  storage_path: string;
}

export type UploadStage =
  | "compressing"
  | "uploading"
  | "saving"
  | "done"
  | "error";

export interface UploadProgressCallbacks {
  onStage?: (stage: UploadStage) => void;
  onProgress?: (loaded: number, total: number) => void;
}

/**
 * Client-side image compression. Re-encodes raster images to JPEG/WEBP at a
 * sensible max dimension to dramatically cut upload size and sync time.
 * Skips signatures (need transparency), SVG/GIF, PDFs, videos, and any
 * non-image type. Falls back to the original blob on any failure.
 */
async function compressImageIfPossible(
  blob: Blob,
  fileKind: FileKind,
): Promise<{ blob: Blob; mime: string; ext: string }> {
  const originalMime = blob.type || "application/octet-stream";
  const originalExt = extFromMime(originalMime);

  if (
    typeof window === "undefined" ||
    !originalMime.startsWith("image/") ||
    originalMime.includes("svg") ||
    originalMime.includes("gif") ||
    fileKind === "completion_signature"
  ) {
    return { blob, mime: originalMime, ext: originalExt };
  }

  // Skip work for already-small images.
  if (blob.size <= 250 * 1024) {
    return { blob, mime: originalMime, ext: originalExt };
  }

  try {
    const bitmap = await createImageBitmap(blob);
    const MAX_DIM = 2000;
    const scale = Math.min(1, MAX_DIM / Math.max(bitmap.width, bitmap.height));
    const w = Math.max(1, Math.round(bitmap.width * scale));
    const h = Math.max(1, Math.round(bitmap.height * scale));

    const canvas =
      typeof OffscreenCanvas !== "undefined"
        ? new OffscreenCanvas(w, h)
        : Object.assign(document.createElement("canvas"), { width: w, height: h });
    const ctx = (canvas as HTMLCanvasElement).getContext("2d");
    if (!ctx) {
      bitmap.close?.();
      return { blob, mime: originalMime, ext: originalExt };
    }
    ctx.drawImage(bitmap, 0, 0, w, h);
    bitmap.close?.();

    const outMime = "image/jpeg";
    const quality = 0.78;
    let compressed: Blob | null = null;
    if ("convertToBlob" in canvas) {
      compressed = await (canvas as OffscreenCanvas).convertToBlob({
        type: outMime,
        quality,
      });
    } else {
      compressed = await new Promise<Blob | null>((resolve) =>
        (canvas as HTMLCanvasElement).toBlob(resolve, outMime, quality),
      );
    }
    if (!compressed || compressed.size >= blob.size) {
      return { blob, mime: originalMime, ext: originalExt };
    }
    return { blob: compressed, mime: outMime, ext: "jpg" };
  } catch {
    return { blob, mime: originalMime, ext: originalExt };
  }
}

/**
 * Upload a blob via XHR so we can report real upload-byte progress. Uses the
 * Supabase Storage REST endpoint with the current session token.
 */
async function uploadWithProgress(
  bucket: string,
  path: string,
  blob: Blob,
  mime: string,
  onProgress?: (loaded: number, total: number) => void,
): Promise<void> {
  const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
  const ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;
  const session = (await supabase.auth.getSession()).data.session;
  const token = session?.access_token ?? ANON_KEY;
  const url = `${SUPABASE_URL}/storage/v1/object/${bucket}/${encodeURI(path)}`;

  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", url, true);
    xhr.setRequestHeader("Authorization", `Bearer ${token}`);
    xhr.setRequestHeader("apikey", ANON_KEY);
    xhr.setRequestHeader("x-upsert", "false");
    xhr.setRequestHeader("Content-Type", mime);
    xhr.upload.onprogress = (e) => {
      if (onProgress) {
        const total = e.lengthComputable ? e.total : blob.size;
        onProgress(e.loaded, total);
      }
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        if (onProgress) onProgress(blob.size, blob.size);
        resolve();
      } else {
        let msg = `Upload failed (${xhr.status})`;
        try {
          const j = JSON.parse(xhr.responseText);
          if (j?.message) msg = j.message;
        } catch {
          /* ignore */
        }
        reject(new Error(msg));
      }
    };
    xhr.onerror = () => reject(new Error("Network error during upload"));
    xhr.onabort = () => reject(new Error("Upload aborted"));
    xhr.send(blob);
  });
}

/**
 * Upload a blob to the appropriate private storage bucket and record it in
 * `work_order_files`. Path layout: `{work_order_id}/{kind}/{timestamp}.{ext}`
 * — this layout is enforced by the storage RLS policies.
 */
export async function uploadEvidence(
  input: UploadEvidenceInput,
  callbacks?: UploadProgressCallbacks,
): Promise<UploadedEvidence> {
  const bucket = FILE_KIND_BUCKETS[input.fileKind];
  callbacks?.onStage?.("compressing");
  const compressed = await compressImageIfPossible(input.blob, input.fileKind);
  const uploadBlob = compressed.blob;
  const mime = compressed.mime;
  const filename = (input.blob as File).name ?? "";
  const fromName = filename.includes(".")
    ? filename.split(".").pop()!.toLowerCase().replace(/[^a-z0-9]/g, "")
    : "";
  // Prefer the post-compression extension when we re-encoded the image, so
  // the stored file actually matches its new MIME type.
  const ext =
    uploadBlob === input.blob && fromName && fromName.length <= 5
      ? fromName
      : compressed.ext;
  const path = `${input.workOrderId}/${input.fileKind}/${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 8)}.${ext}`;

  callbacks?.onStage?.("uploading");
  try {
    await uploadWithProgress(bucket, path, uploadBlob, mime, callbacks?.onProgress);
  } catch (err) {
    callbacks?.onStage?.("error");
    throw err;
  }

  callbacks?.onStage?.("saving");
  const ins = await supabase
    .from("work_order_files")
    .insert({
      work_order_id: input.workOrderId,
      file_kind: input.fileKind,
      storage_bucket: bucket,
      storage_path: path,
      mime_type: mime,
      byte_size: uploadBlob.size,
      captured_by_engineer_id: input.engineerId,
      uploaded_offline: input.uploadedOffline ?? false,
      sync_status: "synced",
      metadata_json: (input.metadata ?? {}) as never,
    })
    .select("id, storage_bucket, storage_path")
    .single();
  if (ins.error) {
    callbacks?.onStage?.("error");
    throw ins.error;
  }
  callbacks?.onStage?.("done");
  return ins.data;
}

/**
 * Issue a short-lived signed URL for a private file.
 */
export async function signedUrl(
  bucket: string,
  path: string,
  expiresInSeconds = 300,
): Promise<string | null> {
  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(path, expiresInSeconds);
  if (error) return null;
  return data.signedUrl;
}

/**
 * Delete a previously-uploaded work-order file: removes the storage object
 * and the matching `work_order_files` row. Best-effort on the storage step
 * so a missing object does not block the row deletion.
 */
export async function deleteEvidence(file: {
  id: string;
  storage_bucket: string;
  storage_path: string;
}): Promise<void> {
  await supabase.storage
    .from(file.storage_bucket)
    .remove([file.storage_path])
    .catch(() => undefined);
  const { error } = await supabase
    .from("work_order_files")
    .delete()
    .eq("id", file.id);
  if (error) throw error;
}