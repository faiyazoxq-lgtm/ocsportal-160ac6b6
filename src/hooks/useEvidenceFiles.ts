import { useCallback, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOfflineStatus } from "./useOfflineStatus";
import { useCurrentEngineer } from "./useEngineerJobs";
import { enqueueMutation } from "@/services/offlineQueue";
import {
  uploadEvidence,
  signedUrl,
  type FileKind,
  type UploadStage,
  deleteEvidence,
} from "@/services/evidenceUploads";

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
  const [uploads, setUploads] = useState<UploadJob[]>([]);

  const updateJob = useCallback(
    (id: string, patch: Partial<UploadJob>) => {
      setUploads((list) =>
        list.map((j) => (j.id === id ? { ...j, ...patch } : j)),
      );
    },
    [],
  );

  const dismiss = useCallback((id: string) => {
    setUploads((list) => list.filter((j) => j.id !== id));
  }, []);

  const mutation = useMutation({
    mutationFn: async (input: { fileKind: FileKind; blob: Blob }) => {
      const engineerId = me?.id ?? null;
      const jobId =
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const name =
        (input.blob as File).name ||
        `${input.fileKind.replace(/_/g, " ")}.bin`;
      const initial: UploadJob = {
        id: jobId,
        name,
        kind: input.fileKind,
        size: input.blob.size,
        stage: "compressing",
        loaded: 0,
        total: input.blob.size,
      };
      setUploads((list) => [...list, initial]);

      if (offline) {
        await enqueueMutation({
          work_order_id: workOrderId,
          engineer_id: engineerId,
          type: "evidence_add",
          payload: { fileKind: input.fileKind, mime: input.blob.type },
          blob: input.blob,
        });
        updateJob(jobId, { stage: "queued", loaded: input.blob.size });
        setTimeout(() => dismiss(jobId), 4000);
        return { queued: true as const };
      }
      try {
        await uploadEvidence(
          {
            workOrderId,
            engineerId,
            fileKind: input.fileKind,
            blob: input.blob,
          },
          {
            onStage: (stage) => updateJob(jobId, { stage }),
            onProgress: (loaded, total) =>
              updateJob(jobId, { loaded, total }),
          },
        );
        updateJob(jobId, { stage: "done" });
        setTimeout(() => dismiss(jobId), 2500);
        return { queued: false as const };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        await enqueueMutation({
          work_order_id: workOrderId,
          engineer_id: engineerId,
          type: "evidence_add",
          payload: {
            fileKind: input.fileKind,
            mime: input.blob.type,
            error: message,
          },
          blob: input.blob,
        });
        updateJob(jobId, { stage: "queued", error: message });
        setTimeout(() => dismiss(jobId), 6000);
        return { queued: true as const };
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["work_order_files", workOrderId] });
    },
  });

  return Object.assign(mutation, { uploads, dismiss });
}

export interface UploadJob {
  id: string;
  name: string;
  kind: FileKind;
  size: number;
  stage: UploadStage | "queued";
  loaded: number;
  total: number;
  error?: string;
}

export function useDeleteEvidence(workOrderId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (file: {
      id: string;
      storage_bucket: string;
      storage_path: string;
    }) => deleteEvidence(file),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["work_order_files", workOrderId] });
    },
  });
}