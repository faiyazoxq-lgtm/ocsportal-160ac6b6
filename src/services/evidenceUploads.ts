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
  if (mime.includes("pdf")) return "pdf";
  if (mime.includes("svg")) return "svg";
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

/**
 * Upload a blob to the appropriate private storage bucket and record it in
 * `work_order_files`. Path layout: `{work_order_id}/{kind}/{timestamp}.{ext}`
 * — this layout is enforced by the storage RLS policies.
 */
export async function uploadEvidence(
  input: UploadEvidenceInput,
): Promise<UploadedEvidence> {
  const bucket = FILE_KIND_BUCKETS[input.fileKind];
  const mime = input.blob.type || "application/octet-stream";
  const ext = extFromMime(mime);
  const path = `${input.workOrderId}/${input.fileKind}/${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 8)}.${ext}`;

  const up = await supabase.storage.from(bucket).upload(path, input.blob, {
    contentType: mime,
    upsert: false,
  });
  if (up.error) throw up.error;

  const ins = await supabase
    .from("work_order_files")
    .insert({
      work_order_id: input.workOrderId,
      file_kind: input.fileKind,
      storage_bucket: bucket,
      storage_path: path,
      mime_type: mime,
      byte_size: input.blob.size,
      captured_by_engineer_id: input.engineerId,
      uploaded_offline: input.uploadedOffline ?? false,
      sync_status: "synced",
      metadata_json: (input.metadata ?? {}) as never,
    })
    .select("id, storage_bucket, storage_path")
    .single();
  if (ins.error) throw ins.error;
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