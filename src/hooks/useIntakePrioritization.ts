import { useMemo } from "react";
import type { IntakeRecord } from "@/types/intake";
import {
  computeDispatchReadiness,
  type DispatchReadiness,
  type DispatchReadinessStatus,
} from "@/lib/dispatchReadiness";

export type ReadinessFilter = "all" | DispatchReadinessStatus;

export type SortKey = "priority" | "received_new" | "received_old" | "client" | "zone" | "confidence";

export interface PrioritizedIntake {
  record: IntakeRecord;
  readiness: DispatchReadiness;
}

function priorityWeight(p: string | null | undefined): number {
  switch (p) {
    case "urgent": return 0;
    case "high": return 1;
    case "normal": return 2;
    case "low": return 3;
    default: return 2;
  }
}

export function useIntakePrioritization(
  rows: IntakeRecord[] | undefined,
  opts: { readiness: ReadinessFilter; sort: SortKey },
): {
  rows: PrioritizedIntake[];
  counts: Record<DispatchReadinessStatus, number>;
  total: number;
} {
  return useMemo(() => {
    const enriched: PrioritizedIntake[] = (rows ?? []).map((r) => ({
      record: r,
      readiness: computeDispatchReadiness(r),
    }));

    const counts: Record<DispatchReadinessStatus, number> = {
      ready: 0,
      needs_review: 0,
      incomplete: 0,
      duplicate_pending: 0,
      parse_failed: 0,
      blocked: 0,
      converted: 0,
      rejected: 0,
    };
    for (const e of enriched) counts[e.readiness.status] += 1;

    const filtered =
      opts.readiness === "all"
        ? enriched
        : enriched.filter((e) => e.readiness.status === opts.readiness);

    const sorted = [...filtered].sort((a, b) => {
      switch (opts.sort) {
        case "priority":
          return a.readiness.priorityRank - b.readiness.priorityRank;
        case "received_new":
          return +new Date(b.record.received_at) - +new Date(a.record.received_at);
        case "received_old":
          return +new Date(a.record.received_at) - +new Date(b.record.received_at);
        case "client":
          return (a.record.extracted_fields_json?.client_name ?? "").localeCompare(
            b.record.extracted_fields_json?.client_name ?? "",
          );
        case "zone":
          return (a.record.suggested_categorization_json?.postcode_zone ?? "").localeCompare(
            b.record.suggested_categorization_json?.postcode_zone ?? "",
          );
        case "confidence":
          return (b.record.parse_confidence ?? 0) - (a.record.parse_confidence ?? 0);
        default:
          return 0;
      }
    });

    // Secondary stable sort: urgency for ties in priority sort already handled by rank.
    void priorityWeight;

    return { rows: sorted, counts, total: enriched.length };
  }, [rows, opts.readiness, opts.sort]);
}