import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  fetchWorkOrderDocuments,
  getDocumentSignedUrl,
  type UnifiedDocument,
} from "@/services/documents";
import { useAuth } from "./useAuth";

export function useWorkOrderDocuments(workOrderId: string | null) {
  return useQuery({
    queryKey: ["work_order_documents", workOrderId],
    enabled: !!workOrderId,
    queryFn: () =>
      workOrderId ? fetchWorkOrderDocuments(workOrderId) : Promise.resolve([]),
  });
}

export function useSecureFileUrl(
  doc: Pick<UnifiedDocument, "storage_bucket" | "storage_path"> | null,
  expiresInSeconds = 300,
) {
  return useQuery({
    queryKey: [
      "doc_signed_url",
      doc?.storage_bucket ?? null,
      doc?.storage_path ?? null,
      expiresInSeconds,
    ],
    enabled: !!doc,
    staleTime: (expiresInSeconds - 30) * 1000,
    queryFn: () => (doc ? getDocumentSignedUrl(doc, expiresInSeconds) : null),
  });
}

/**
 * Dispatcher / admin upload to a work order. Files are stored under the
 * existing source-docs or evidence buckets and recorded in work_order_files
 * with metadata flag `admin_upload=true` so the UI can group them.
 */
export function useUploadWorkOrderDocument(workOrderId: string) {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (input: {
      file: File;
      displayName?: string;
      asSourcePdf?: boolean;
    }) => {
      const mime = input.file.type || "application/octet-stream";
      const asPdf =
        input.asSourcePdf ?? mime === "application/pdf";
      const bucket = asPdf
        ? "work-order-source-docs"
        : "work-order-evidence";
      const fileKind = asPdf ? "source_pdf" : "general_evidence";
      const safeName = input.file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const path = `${workOrderId}/${fileKind}/${Date.now()}-${safeName}`;
      const up = await supabase.storage.from(bucket).upload(path, input.file, {
        contentType: mime,
        upsert: false,
      });
      if (up.error) throw up.error;
      const ins = await supabase
        .from("work_order_files")
        .insert({
          work_order_id: workOrderId,
          file_kind: fileKind,
          storage_bucket: bucket,
          storage_path: path,
          mime_type: mime,
          byte_size: input.file.size,
          captured_by_profile_id: user?.id ?? null,
          uploaded_offline: false,
          sync_status: "synced",
          metadata_json: {
            admin_upload: true,
            display_name: input.displayName ?? input.file.name,
          } as never,
        })
        .select("id")
        .single();
      if (ins.error) throw ins.error;
      return ins.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["work_order_documents", workOrderId] });
      qc.invalidateQueries({ queryKey: ["work_order_files", workOrderId] });
    },
  });
}

/**
 * Lightweight audit list — for now derived from the unified docs themselves
 * (uploader, timestamp, category). A separate event log would be a future
 * enhancement.
 */
export function useDocumentAudit(workOrderId: string | null) {
  const q = useWorkOrderDocuments(workOrderId);
  return {
    ...q,
    entries: (q.data ?? []).map((d) => ({
      id: d.id,
      category: d.source_context,
      file_kind: d.file_kind,
      display_name: d.display_name,
      uploaded_at: d.created_at,
      uploaded_by_profile_id: d.uploaded_by_profile_id,
      uploaded_by_engineer_id: d.uploaded_by_engineer_id,
    })),
  };
}