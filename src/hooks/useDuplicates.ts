import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  detectIntakeDuplicates,
  resolveDuplicateReview,
} from "@/lib/duplicateDetection.functions";

export function useDetectDuplicates() {
  const qc = useQueryClient();
  const fn = useServerFn(detectIntakeDuplicates);
  return useMutation({
    mutationFn: (args: { intakeId: string }) => fn({ data: { intakeId: args.intakeId } }),
    onSuccess: (_, v) => {
      qc.invalidateQueries({ queryKey: ["intake_records"] });
      qc.invalidateQueries({ queryKey: ["intake_records", "detail", v.intakeId] });
      qc.invalidateQueries({ queryKey: ["parsing_review_actions", v.intakeId] });
    },
  });
}

export function useResolveDuplicateReview() {
  const qc = useQueryClient();
  const fn = useServerFn(resolveDuplicateReview);
  return useMutation({
    mutationFn: (args: {
      intakeId: string;
      decision: "dismissed" | "confirmed" | "linked";
      workOrderId?: string;
      note?: string;
    }) =>
      fn({
        data: {
          intakeId: args.intakeId,
          decision: args.decision,
          workOrderId: args.workOrderId,
          note: args.note,
        },
      }),
    onSuccess: (_, v) => {
      qc.invalidateQueries({ queryKey: ["intake_records"] });
      qc.invalidateQueries({ queryKey: ["intake_records", "detail", v.intakeId] });
      qc.invalidateQueries({ queryKey: ["parsing_review_actions", v.intakeId] });
    },
  });
}