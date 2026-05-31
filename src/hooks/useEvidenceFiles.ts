import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOfflineStatus } from "./useOfflineStatus";
import { useCurrentEngineer } from "./useEngineerJobs";
import { enqueueMutation } from "@/services/offlineQueue";
import { uploadEvidence, signedUrl, type FileKind } from "@/services/evidenceUploads";

export interface WorkOrderFile {
  id: string;
  work_order_id: string;
  file_kind: FileKind;
  storage_bucket: string;
  storage_path: string;
  mime_type: string | null;
  byte_size: number | null;
  uploaded_at: string;
  uploaded_offline: boolean;
  sync_status: "pending" | "syncing" | "synced" | "failed";
}

export function useEvidenceFiles(workOrderId: string | null) {
  return useQuery({
    queryKey: ["work_order_files", workOrderId],
    enabled: !!workOrderId,
    queryFn: async (): Promise<WorkOrderFile[]> => {
      if (!workOrderId) return [];
      const { data, error } = await supabase
        .from("work_order_files")
        .select(
          "id, work_order_id, file_kind, storage_bucket, storage_path, mime_type, byte_size, uploaded_at, uploaded_offline, sync_status",
        )
        .eq("work_order_id", workOrderId)
        .order("uploaded_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as WorkOrderFile[];
    },
  });
}

export function useSignedUrl(
  bucket: string | null,
  path: string | null,
  expiresIn = 300,
) {
  return useQuery({
    queryKey: ["signed_url", bucket, path, expiresIn],
    enabled: !!bucket && !!path,
    staleTime: (expiresIn - 30) * 1000,
    queryFn: () =>
      bucket && path ? signedUrl(bucket, path, expiresIn) : null,
  });
}

export function useUploadEvidence(workOrderId: string) {
  const qc = useQueryClient();
  const { offline } = useOfflineStatus();
  const { data: me } = useCurrentEngineer();

  return useMutation({
    mutationFn: async (input: { fileKind: FileKind; blob: Blob }) => {
      const engineerId = me?.id ?? null;
      if (offline) {
        await enqueueMutation({
          work_order_id: workOrderId,
          engineer_id: engineerId,
          type: "evidence_add",
          payload: { fileKind: input.fileKind, mime: input.blob.type },
          blob: input.blob,
        });
        return { queued: true as const };
      }
      try {
        await uploadEvidence({
          workOrderId,
          engineerId,
          fileKind: input.fileKind,
          blob: input.blob,
        });
        return { queued: false as const };
      } catch (err) {
        await enqueueMutation({
          work_order_id: workOrderId,
          engineer_id: engineerId,
          type: "evidence_add",
          payload: {
            fileKind: input.fileKind,
            mime: input.blob.type,
            error: err instanceof Error ? err.message : String(err),
          },
          blob: input.blob,
        });
        return { queued: true as const };
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["work_order_files", workOrderId] });
    },
  });
}