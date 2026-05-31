import { useMemo } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useClients } from "@/hooks/useClients";
import {
  computeNormalizationPreview,
  type NormalizationPreview,
  NORMALIZATION_VERSION,
} from "@/lib/intakeNormalization";
import type {
  IntakeExtractedFields,
  IntakeRecord,
  IntakeSuggestedCategorization,
} from "@/types/intake";

export function useNormalizationPreview(args: {
  extracted: IntakeExtractedFields;
  categorization: IntakeSuggestedCategorization;
}): NormalizationPreview {
  const { data: clients } = useClients();
  return useMemo(
    () =>
      computeNormalizationPreview({
        extracted: args.extracted,
        categorization: args.categorization,
        clients: (clients ?? []).map((c) => ({ id: c.id, client_name: c.client_name })),
      }),
    [args.extracted, args.categorization, clients],
  );
}

export function useNormalizationWarnings(record: IntakeRecord | null | undefined) {
  return useMemo(() => {
    const stored = (record?.normalization_warnings_json ?? []) as Array<{
      field: string;
      severity: string;
      message: string;
    }>;
    return stored;
  }, [record?.normalization_warnings_json]);
}

export function useApplyNormalization() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: { id: string; preview: NormalizationPreview }) => {
      const { data: u } = await supabase.auth.getUser();
      const { error } = await supabase
        .from("intake_records")
        .update({
          normalized_fields_json: args.preview.normalized as never,
          normalization_warnings_json: args.preview.warnings as never,
          normalization_version: NORMALIZATION_VERSION,
          normalization_applied_at: new Date().toISOString(),
          normalization_applied_by: u.user?.id ?? null,
        })
        .eq("id", args.id);
      if (error) throw error;
      await supabase.from("parsing_review_actions").insert({
        intake_record_id: args.id,
        reviewer_profile_id: u.user?.id ?? null,
        action_type: "apply_normalization",
        previous_values_json: {} as never,
        next_values_json: {
          normalized: args.preview.normalized,
          warnings: args.preview.warnings,
          version: NORMALIZATION_VERSION,
        } as never,
      });
    },
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ["intake_records"] });
      qc.invalidateQueries({ queryKey: ["parsing_review_actions", v.id] });
    },
  });
}