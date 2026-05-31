import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { IntakeRecord, IntakeSourceType } from "@/types/intake";

const BUCKET = "intake-sources";
const TABLE = "intake_records" as const;

export interface ManualIntakeInput {
  source_type: IntakeSourceType;
  source_reference?: string | null;
  source_sender?: string | null;
  source_subject?: string | null;
  received_at?: string | null;
  raw_text?: string | null;
  file?: File | null;
  notes?: string | null;
}

function safeName(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]+/g, "_").slice(0, 120);
}

export function useCreateIntakeSource() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: ManualIntakeInput): Promise<IntakeRecord> => {
      const { data: u } = await supabase.auth.getUser();
      const userId = u.user?.id ?? null;

      let storage_path: string | null = null;
      let storage_bucket: string | null = null;
      let original_filename: string | null = null;
      let original_mime_type: string | null = null;
      let original_byte_size: number | null = null;

      if (input.file) {
        const f = input.file;
        const ts = Date.now();
        const path = `${userId ?? "anon"}/${ts}-${safeName(f.name)}`;
        const up = await supabase.storage.from(BUCKET).upload(path, f, {
          contentType: f.type || undefined,
          upsert: false,
        });
        if (up.error) throw up.error;
        storage_path = path;
        storage_bucket = BUCKET;
        original_filename = f.name;
        original_mime_type = f.type || null;
        original_byte_size = f.size;
      }

      const { data, error } = await supabase
        .from(TABLE)
        .insert({
          source_type: input.source_type,
          source_reference: input.source_reference ?? null,
          source_sender: input.source_sender ?? null,
          source_subject: input.source_subject ?? null,
          received_at: input.received_at ?? new Date().toISOString(),
          source_file_path: storage_path,
          source_bucket: storage_bucket,
          original_filename,
          original_mime_type,
          original_byte_size,
          raw_text: input.raw_text ?? null,
          raw_payload_json: (input.notes ? { intake_notes: input.notes } : {}) as never,
          extracted_fields_json: {} as never,
          suggested_categorization_json: {} as never,
          missing_fields_json: [] as never,
          parsing_issues_json: [] as never,
          duplicate_candidates_json: [] as never,
          parse_status: "received",
          capture_status: "captured",
          created_by: userId,
        })
        .select("*")
        .single();
      if (error) throw error;
      return data as unknown as IntakeRecord;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["intake_records"] });
    },
  });
}

export function useAttachIntakeSourceFile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: { intakeId: string; file: File }) => {
      const { data: u } = await supabase.auth.getUser();
      const path = `${u.user?.id ?? "anon"}/${args.intakeId}/${Date.now()}-${safeName(args.file.name)}`;
      const up = await supabase.storage.from(BUCKET).upload(path, args.file, {
        contentType: args.file.type || undefined,
        upsert: false,
      });
      if (up.error) throw up.error;
      const { error } = await supabase
        .from(TABLE)
        .update({
          source_file_path: path,
          source_bucket: BUCKET,
          original_filename: args.file.name,
          original_mime_type: args.file.type || null,
          original_byte_size: args.file.size,
        })
        .eq("id", args.intakeId);
      if (error) throw error;
    },
    onSuccess: (_, v) => {
      qc.invalidateQueries({ queryKey: ["intake_records"] });
      qc.invalidateQueries({ queryKey: ["intake_records", "detail", v.intakeId] });
    },
  });
}

export function useOriginalSourceUrl(record: Pick<IntakeRecord, "source_bucket" | "source_file_path"> | null | undefined) {
  const bucket = record?.source_bucket ?? null;
  const path = record?.source_file_path ?? null;
  return useQuery({
    queryKey: ["intake_source_url", bucket, path],
    enabled: !!bucket && !!path,
    staleTime: 60_000,
    queryFn: async (): Promise<string | null> => {
      if (!bucket || !path) return null;
      const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, 60 * 10);
      if (error) throw error;
      return data?.signedUrl ?? null;
    },
  });
}