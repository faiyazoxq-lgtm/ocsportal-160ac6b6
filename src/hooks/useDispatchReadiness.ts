import { useMemo } from "react";
import type { IntakeRecord } from "@/types/intake";
import { computeDispatchReadiness, type DispatchReadiness } from "@/lib/dispatchReadiness";

export function useDispatchReadiness(record: IntakeRecord | null | undefined): DispatchReadiness | null {
  return useMemo(() => (record ? computeDispatchReadiness(record) : null), [record]);
}