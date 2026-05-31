import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { parseIntakeRecord } from "@/lib/intakeParser.functions";

export function useParseIntakeRecord() {
  const qc = useQueryClient();
  const fn = useServerFn(parseIntakeRecord);
  return useMutation({
    mutationFn: async (args: { intakeId: string; force?: boolean }) => {
      return fn({ data: { intakeId: args.intakeId, force: args.force ?? false } });
    },
    onSuccess: (_, v) => {
      qc.invalidateQueries({ queryKey: ["intake_records"] });
      qc.invalidateQueries({ queryKey: ["intake_records", "detail", v.intakeId] });
      qc.invalidateQueries({ queryKey: ["parsing_review_actions", v.intakeId] });
    },
  });
}

export function useReprocessIntakeRecord() {
  return useParseIntakeRecord();
}