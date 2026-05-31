import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { signedUrl } from "./evidenceUploads";

export type FileKind = Database["public"]["Enums"]["file_kind"];

export type DocumentSourceContext =
  | "source_pdf"
  | "intake_attachment"
  | "evidence"
  | "signature"
  | "receipt"
  | "admin_upload"
  | "message_attachment";

export interface UnifiedDocument {
  id: string;
  work_order_id: string;
  source_context: DocumentSourceContext;
  source_record_id: string | null;
  file_kind: FileKind | string;
  display_name: string;
  storage_bucket: string;
  storage_path: string;
  mime_type: string | null;
  file_size: number | null;
  uploaded_by_profile_id: string | null;
  uploaded_by_engineer_id: string | null;
  created_at: string;
  metadata_json: Record<string, unknown>;
  sync_status?: "pending" | "syncing" | "synced" | "failed" | null;
}

const KIND_TO_CONTEXT: Record<FileKind, DocumentSourceContext> = {
  source_pdf: "source_pdf",
  arrival_photo: "evidence",
  before_leave_photo: "evidence",
  general_evidence: "evidence",
  completion_signature: "signature",
  receipt_photo: "receipt",
};

function deriveDisplayName(path: string, kind: string): string {
  const tail = path.split("/").pop() ?? path;
  return tail || kind;
}

/**
 * Fetch all documents/media related to a work order, unifying:
 *  - work_order_files (source_pdf, evidence, signature, receipt, general)
 *  - intake_records source attachment (if converted from intake)
 *
 * RLS already restricts visibility: dispatchers see all, engineers see
 * only their assigned jobs' files.
 */
export async function fetchWorkOrderDocuments(
  workOrderId: string,
): Promise<UnifiedDocument[]> {
  const [filesRes, intakeRes] = await Promise.all([
    supabase
      .from("work_order_files")
      .select(
        "id, work_order_id, file_kind, storage_bucket, storage_path, mime_type, byte_size, uploaded_at, captured_by_profile_id, captured_by_engineer_id, metadata_json, sync_status",
      )
      .eq("work_order_id", workOrderId)
      .order("uploaded_at", { ascending: false }),
    supabase
      .from("intake_records")
      .select(
        "id, source_bucket, source_file_path, source_type, source_reference, created_at, created_by, raw_payload_json",
      )
      .eq("converted_work_order_id", workOrderId),
  ]);

  const out: UnifiedDocument[] = [];

  if (!filesRes.error && filesRes.data) {
    for (const f of filesRes.data) {
      const kind = f.file_kind as FileKind;
      const ctxFromKind = KIND_TO_CONTEXT[kind] ?? "evidence";
      const meta = (f.metadata_json ?? {}) as Record<string, unknown>;
      const isAdminUpload = meta.admin_upload === true;
      out.push({
        id: f.id,
        work_order_id: f.work_order_id,
        source_context: isAdminUpload ? "admin_upload" : ctxFromKind,
        source_record_id: f.id,
        file_kind: kind,
        display_name:
          (meta.display_name as string | undefined) ??
          deriveDisplayName(f.storage_path, kind),
        storage_bucket: f.storage_bucket,
        storage_path: f.storage_path,
        mime_type: f.mime_type,
        file_size: f.byte_size,
        uploaded_by_profile_id: f.captured_by_profile_id,
        uploaded_by_engineer_id: f.captured_by_engineer_id,
        created_at: f.uploaded_at,
        metadata_json: meta,
        sync_status: f.sync_status,
      });
    }
  }

  if (!intakeRes.error && intakeRes.data) {
    for (const r of intakeRes.data) {
      if (!r.source_bucket || !r.source_file_path) continue;
      out.push({
        id: `intake-${r.id}`,
        work_order_id: workOrderId,
        source_context: "intake_attachment",
        source_record_id: r.id,
        file_kind: "source_pdf",
        display_name:
          deriveDisplayName(r.source_file_path, "intake") ||
          r.source_reference ||
          "Intake source",
        storage_bucket: r.source_bucket,
        storage_path: r.source_file_path,
        mime_type: null,
        file_size: null,
        uploaded_by_profile_id: r.created_by,
        uploaded_by_engineer_id: null,
        created_at: r.created_at,
        metadata_json: { intake_source_type: r.source_type },
        sync_status: null,
      });
    }
  }

  return out.sort(
    (a, b) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );
}

export async function getDocumentSignedUrl(
  doc: Pick<UnifiedDocument, "storage_bucket" | "storage_path">,
  expiresInSeconds = 300,
): Promise<string | null> {
  return signedUrl(doc.storage_bucket, doc.storage_path, expiresInSeconds);
}

export const DOCUMENT_CATEGORY_LABELS: Record<DocumentSourceContext, string> = {
  source_pdf: "Source PDFs",
  intake_attachment: "Intake attachments",
  evidence: "Evidence",
  signature: "Signatures",
  receipt: "Receipts",
  admin_upload: "Admin uploads",
  message_attachment: "Message attachments",
};

export const DOCUMENT_CATEGORY_ORDER: DocumentSourceContext[] = [
  "source_pdf",
  "intake_attachment",
  "evidence",
  "signature",
  "receipt",
  "admin_upload",
  "message_attachment",
];

export function isPreviewableImage(mime: string | null): boolean {
  if (!mime) return false;
  return mime.startsWith("image/");
}

export function isPreviewablePdf(mime: string | null, name: string): boolean {
  if (mime === "application/pdf") return true;
  return name.toLowerCase().endsWith(".pdf");
}