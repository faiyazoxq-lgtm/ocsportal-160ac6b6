import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import type {
  RecommendationRecord,
  RecommendationSuggestion,
  RecommendationTargetType,
  RecommendationType,
} from "@/types/recommendations";
import type { WorkOrderWithRelations } from "@/types/workOrders";
import type { Engineer } from "@/types/engineers";
import type { IntakeRecord } from "@/types/intake";
import type { BillingCase } from "@/types/billing";

/* ---------------------------------------------------------------- */
/* Persistence layer — only stores dismissal / acknowledgement state */
/* ---------------------------------------------------------------- */

// `recommendations` was added in a recent migration; types.ts regenerates on
// migration apply but we keep a narrow client cast here for safety.
type RecRow = Pick<
  RecommendationRecord,
  | "id"
  | "recommendation_type"
  | "target_record_type"
  | "target_record_id"
  | "dismissed_at"
  | "acknowledged_at"
>;

function recKey(t: RecommendationType, targetId: string, extra?: string) {
  return extra ? `${t}:${targetId}:${extra}` : `${t}:${targetId}`;
}

function suggestionExtra(s: RecommendationSuggestion): string | undefined {
  return s.key.includes(":") ? s.key.split(":").slice(2).join(":") || undefined : undefined;
}

export function useRecommendationState(
  targetType: RecommendationTargetType,
  targetId: string | null,
) {
  return useQuery({
    enabled: !!targetId,
    queryKey: ["recommendations_state", targetType, targetId],
    queryFn: async () => {
      const { data, error } = await (supabase as unknown as {
        from: (t: string) => {
          select: (s: string) => {
            eq: (k: string, v: string) => {
              eq: (k: string, v: string) => Promise<{ data: RecRow[] | null; error: Error | null }>;
            };
          };
        };
      })
        .from("recommendations")
        .select(
          "id, recommendation_type, target_record_type, target_record_id, dismissed_at, acknowledged_at",
        )
        .eq("target_record_type", targetType)
        .eq("target_record_id", targetId!);
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useDismissRecommendation() {
  const qc = useQueryClient();
  const { session } = useAuth();
  return useMutation({
    mutationFn: async (args: {
      targetType: RecommendationTargetType;
      targetId: string;
      suggestion: RecommendationSuggestion;
    }) => {
      const payload = {
        recommendation_type: args.suggestion.type,
        target_record_type: args.targetType,
        target_record_id: args.targetId,
        recommendation_payload_json: args.suggestion.payload ?? {},
        rationale_json: args.suggestion.rationale,
        confidence_score: args.suggestion.confidence ?? null,
        dismissed_at: new Date().toISOString(),
        dismissed_by: session?.user?.id ?? null,
      };
      const { error } = await (supabase as unknown as {
        from: (t: string) => {
          insert: (p: unknown) => Promise<{ error: Error | null }>;
        };
      })
        .from("recommendations")
        .insert(payload);
      if (error) throw error;
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({
        queryKey: ["recommendations_state", vars.targetType, vars.targetId],
      });
    },
  });
}

export function useAcknowledgeRecommendation() {
  const qc = useQueryClient();
  const { session } = useAuth();
  return useMutation({
    mutationFn: async (args: {
      targetType: RecommendationTargetType;
      targetId: string;
      suggestion: RecommendationSuggestion;
    }) => {
      const payload = {
        recommendation_type: args.suggestion.type,
        target_record_type: args.targetType,
        target_record_id: args.targetId,
        recommendation_payload_json: args.suggestion.payload ?? {},
        rationale_json: args.suggestion.rationale,
        confidence_score: args.suggestion.confidence ?? null,
        acknowledged_at: new Date().toISOString(),
        acknowledged_by: session?.user?.id ?? null,
      };
      const { error } = await (supabase as unknown as {
        from: (t: string) => {
          insert: (p: unknown) => Promise<{ error: Error | null }>;
        };
      })
        .from("recommendations")
        .insert(payload);
      if (error) throw error;
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({
        queryKey: ["recommendations_state", vars.targetType, vars.targetId],
      });
    },
  });
}

/** Filter out suggestions that already have a stored dismissal of the same type+target. */
export function filterActive(
  suggestions: RecommendationSuggestion[],
  state: RecRow[] | undefined,
): RecommendationSuggestion[] {
  if (!state || state.length === 0) return suggestions;
  const dismissed = new Set(
    state.filter((s) => s.dismissed_at).map((s) => s.recommendation_type),
  );
  return suggestions.filter((s) => !dismissed.has(s.type));
}

/* ---------------------------------------------------------------- */
/* Intake recommendations                                            */
/* ---------------------------------------------------------------- */

export function useIntakeRecommendations(record: IntakeRecord | null | undefined) {
  return useMemo<RecommendationSuggestion[]>(() => {
    if (!record) return [];
    const out: RecommendationSuggestion[] = [];
    const cat = record.suggested_categorization_json ?? {};
    const ex = record.extracted_fields_json ?? {};

    // Categorization confidence summary
    const catBits: string[] = [];
    if (false) catBits.push(`trade $`);
    if (false) catBits.push(`complexity $`);
    if (cat.priority_level) catBits.push(`priority ${cat.priority_level}`);
    if (cat.postcode_zone) catBits.push(`zone ${cat.postcode_zone}`);
    if (catBits.length) {
      out.push({
        key: recKey("intake_categorization", record.id),
        type: "intake_categorization",
        severity: (record.categorization_confidence ?? 0) >= 0.8 ? "info" : "suggest",
        title: `Likely ${catBits.join(" · ")}`,
        detail: "Based on parser output and source text.",
        confidence: record.categorization_confidence ?? undefined,
        rationale: [
          {
            label: `Categorization confidence ${Math.round((record.categorization_confidence ?? 0) * 100)}%`,
          },
          { label: `Parse confidence ${Math.round((record.parse_confidence ?? 0) * 100)}%` },
        ],
      });
    }

    // Diary-ready signal
    const missing = record.missing_fields_json ?? [];
    const hasAddress = !!(ex.address_line_1 && ex.postcode);
    const hasScope = !!(ex.job_summary && ex.job_description);
    const diaryReady =
      cat.diary_ready === true ||
      (missing.length === 0 && hasAddress && hasScope && (record.parse_confidence ?? 0) >= 0.85);
    out.push({
      key: recKey("intake_diary_ready", record.id),
      type: "intake_diary_ready",
      severity: diaryReady ? "info" : "warn",
      title: diaryReady ? "Looks diary-ready" : "Not diary-ready yet",
      detail: diaryReady
        ? "Address, scope, and confidence look sufficient to schedule."
        : "Missing key fields before this can be planned.",
      rationale: [
        { label: hasAddress ? "Address present" : "Address incomplete" },
        { label: hasScope ? "Scope present" : "Scope thin or missing" },
        ...(missing.length ? [{ label: `Missing: ${missing.join(", ")}` }] : []),
      ],
    });

    // Duplicate explanation
    const dupes = record.duplicate_candidates_json ?? [];
    if (dupes.length > 0) {
      const top = dupes[0];
      out.push({
        key: recKey("intake_duplicate", record.id),
        type: "intake_duplicate",
        severity: top.score >= 0.85 ? "warn" : "suggest",
        title: `Possible duplicate of ${top.order_no}`,
        detail: `Top match ${Math.round(top.score * 100)}% — ${top.reason}.`,
        confidence: top.score,
        payload: { work_order_id: top.work_order_id, order_no: top.order_no },
        rationale: dupes
          .slice(0, 3)
          .map((d) => ({ label: `${d.order_no}: ${d.reason}`, weight: d.score })),
      });
    }

    return out;
  }, [record]);
}

/* ---------------------------------------------------------------- */
/* Assignment recommendations                                        */
/* ---------------------------------------------------------------- */

const COMPLEXITY_RANK = { basic: 1, intermediate: 2, advanced: 3 } as const;

export interface AssignmentCandidate {
  engineer: Engineer;
  score: number;
  rationale: { label: string; weight?: number }[];
  warnings: string[];
  suitableAsLead: boolean;
  plannedLoad: number;
}

export function useAssignmentRecommendations(
  workOrder: WorkOrderWithRelations | null | undefined,
  engineers: Engineer[] | undefined,
  scheduledJobs?: WorkOrderWithRelations[],
) {
  return useMemo<AssignmentCandidate[]>(() => {
    if (!workOrder || !engineers) return [];
    const loadByEng = new Map<string, number>();
    (scheduledJobs ?? []).forEach((w) => {
      (w.assignments ?? []).forEach((a) => {
        if (!a.engineer?.id) return;
        if (!["assigned", "accepted"].includes(a.assignment_status)) return;
        loadByEng.set(
          a.engineer.id,
          (loadByEng.get(a.engineer.id) ?? 0) + (w.estimated_duration_minutes ?? 60),
        );
      });
    });

    const out: AssignmentCandidate[] = engineers.map((e) => {
      const rationale: { label: string; weight?: number }[] = [];
      const warnings: string[] = [];
      let score = 0;

      if (!e.active_status) {
        warnings.push("inactive");
      }

      if (false) {
        score += 4;
        rationale.push({ label: `Primary trade matches ($)`, weight: 4 });
      } else if (false) {
        rationale.push({ label: `Different primary trade (${"—"})`, weight: 0 });
      }

      const tagOverlap = (workOrder.trade_tags ?? []).filter((t) => e.trade_tags.includes(t));
      if (tagOverlap.length) {
        score += tagOverlap.length;
        rationale.push({
          label: `Trade tags match: ${tagOverlap.join(", ")}`,
          weight: tagOverlap.length,
        });
      }

      const certMissing = (workOrder.certification_tags ?? []).filter(
        (c) => !e.certification_tags.includes(c),
      );
      if (certMissing.length) {
        score -= certMissing.length * 2;
        warnings.push(`missing cert: ${certMissing.join(", ")}`);
        rationale.push({
          label: `Missing certifications: ${certMissing.join(", ")}`,
          weight: -certMissing.length * 2,
        });
      }

      if (workOrder.postcode_zone) {
        const zonePrefix = workOrder.postcode_zone;
        const covers = e.covered_postcode_zones.some(
          (z) => z === zonePrefix || zonePrefix.startsWith(z) || z.startsWith(zonePrefix),
        );
        if (covers) {
          score += 2;
          rationale.push({ label: `Covers zone ${zonePrefix}`, weight: 2 });
        } else {
          rationale.push({ label: `Zone ${zonePrefix} not in coverage`, weight: 0 });
        }
      }

      if (false) {
        if (COMPLEXITY_RANK[null] >= COMPLEXITY_RANK[null]) {
          score += 1;
          rationale.push({
            label: `Complexity cap $ ≥ $`,
            weight: 1,
          });
        } else {
          score -= 3;
          warnings.push(`cap below $`);
          rationale.push({
            label: `Complexity cap $ below $`,
            weight: -3,
          });
        }
      }

      const plannedLoad = loadByEng.get(e.id) ?? 0;
      if (plannedLoad > 480) {
        score -= 2;
        warnings.push(`heavy planned load (${Math.round(plannedLoad / 60)}h)`);
        rationale.push({
          label: `Planned ${Math.round(plannedLoad / 60)}h already`,
          weight: -2,
        });
      } else if (plannedLoad > 0) {
        rationale.push({ label: `Planned ${Math.round(plannedLoad / 60)}h today`, weight: 0 });
      } else {
        rationale.push({ label: "No planned load", weight: 1 });
        score += 1;
      }

      return {
        engineer: e,
        score,
        rationale,
        warnings,
        suitableAsLead: !!e.can_lead && e.active_status && score >= 3,
        plannedLoad,
      };
    });

    return out
      .filter((c) => c.engineer.active_status)
      .sort((a, b) => b.score - a.score);
  }, [workOrder, engineers, scheduledJobs]);
}

/* ---------------------------------------------------------------- */
/* Scheduling recommendations                                        */
/* ---------------------------------------------------------------- */

export function useSchedulingRecommendations(
  workOrder: WorkOrderWithRelations | null | undefined,
) {
  return useMemo<RecommendationSuggestion[]>(() => {
    if (!workOrder) return [];
    const out: RecommendationSuggestion[] = [];
    const duration = workOrder.estimated_duration_minutes ?? 0;
    const complexity = null;
    const priority = workOrder.priority_level;

    // Slot suggestion
    const todayBias = priority === "urgent" || priority === "high";
    const slotSuggestion = todayBias ? "Same-day AM if engineer available" : "Next working day";
    out.push({
      key: recKey("scheduling_slot", workOrder.id),
      type: "scheduling_slot",
      severity: todayBias ? "warn" : "suggest",
      title: `Suggested window: ${slotSuggestion}`,
      detail:
        priority === "urgent"
          ? "Urgent priority — schedule first available slot."
          : priority === "high"
            ? "High priority — schedule within 24h."
            : "Standard priority — within 2–3 working days.",
      rationale: [
        { label: `Priority ${priority}` },
        ...(duration ? [{ label: `Estimated ${duration} min` }] : []),
      ],
    });

    // Duration warnings
    if (duration > 0) {
      const expected =
        complexity === "advanced" ? 180 : complexity === "intermediate" ? 120 : 60;
      if (duration < expected * 0.5) {
        out.push({
          key: recKey("scheduling_duration", workOrder.id, "under"),
          type: "scheduling_duration",
          severity: "warn",
          title: `Duration may be under-scoped (${duration} min)`,
          detail: `Typical ${complexity ?? "this type of"} jobs run ~${expected} min.`,
          rationale: [
            { label: `Planned ${duration} min`, weight: duration },
            { label: `Expected ~${expected} min for ${complexity ?? "complexity"}` },
          ],
        });
      } else if (duration > expected * 2) {
        out.push({
          key: recKey("scheduling_duration", workOrder.id, "over"),
          type: "scheduling_duration",
          severity: "suggest",
          title: `Duration may be over-scoped (${duration} min)`,
          detail: `Typical ${complexity ?? "this type of"} jobs run ~${expected} min — consider splitting.`,
          rationale: [
            { label: `Planned ${duration} min`, weight: duration },
            { label: `Expected ~${expected} min for ${complexity ?? "complexity"}` },
          ],
        });
      }
    } else {
      out.push({
        key: recKey("scheduling_duration", workOrder.id, "missing"),
        type: "scheduling_duration",
        severity: "suggest",
        title: "No estimated duration set",
        detail: "Add an estimate so capacity planning is accurate.",
        rationale: [{ label: "estimated_duration_minutes is empty" }],
      });
    }

    // Co-assignment hint
    const needsCoAssign =
      (workOrder.engineers_required ?? 1) > 1 ||
      complexity === "advanced" ||
      duration > 240 ||
      (workOrder.trade_tags?.length ?? 0) >= 3;
    if (needsCoAssign) {
      out.push({
        key: recKey("scheduling_coassign", workOrder.id),
        type: "scheduling_coassign",
        severity: "suggest",
        title: "Co-assignment likely needed",
        detail: "Consider assigning a support engineer alongside the lead.",
        rationale: [
          ...(workOrder.engineers_required > 1
            ? [{ label: `engineers_required = ${workOrder.engineers_required}` }]
            : []),
          ...(complexity === "advanced" ? [{ label: "Advanced complexity" }] : []),
          ...(duration > 240 ? [{ label: `Duration ${duration} min (>4h)` }] : []),
          ...((workOrder.trade_tags?.length ?? 0) >= 3
            ? [{ label: `${workOrder.trade_tags.length} trade tags` }]
            : []),
        ],
      });
    }

    return out;
  }, [workOrder]);
}

/* ---------------------------------------------------------------- */
/* Billing recommendations                                           */
/* ---------------------------------------------------------------- */

export function useBillingRecommendations(
  workOrder: WorkOrderWithRelations | null | undefined,
  billingCase: BillingCase | null | undefined,
  expenseCount: number,
  receiptCount: number,
  evidenceCount: number,
) {
  return useMemo<RecommendationSuggestion[]>(() => {
    if (!workOrder) return [];
    const out: RecommendationSuggestion[] = [];

    const isCompletedish =
      workOrder.current_status === "field_submitted_complete" ||
      workOrder.current_status === "closed";
    const ready =
      isCompletedish &&
      evidenceCount > 0 &&
      (expenseCount === 0 || receiptCount >= expenseCount) &&
      !!workOrder.client_id &&
      !!workOrder.order_no;

    if (ready && (!billingCase || billingCase.billing_status === "pending_review")) {
      out.push({
        key: recKey("billing_invoice_ready", workOrder.id),
        type: "billing_invoice_ready",
        severity: "suggest",
        title: "Looks invoice-ready",
        detail: "Evidence, receipts, and outcome all present.",
        rationale: [
          { label: `Status ${workOrder.current_status}` },
          { label: `${evidenceCount} evidence file(s)` },
          { label: `${expenseCount} expense(s), ${receiptCount} receipt(s)` },
        ],
      });
    }

    if (isCompletedish && expenseCount > 0 && receiptCount < expenseCount) {
      out.push({
        key: recKey("billing_missing_evidence", workOrder.id, "receipts"),
        type: "billing_missing_evidence",
        severity: "warn",
        title: "Missing receipts before billing",
        detail: `${expenseCount} expense(s) recorded, only ${receiptCount} receipt file(s) attached.`,
        rationale: [
          { label: `${expenseCount} expense rows` },
          { label: `${receiptCount} receipt files` },
        ],
      });
    }

    if (isCompletedish && evidenceCount === 0) {
      out.push({
        key: recKey("billing_missing_evidence", workOrder.id, "evidence"),
        type: "billing_missing_evidence",
        severity: "warn",
        title: "No evidence attached",
        detail: "Add photos or signed evidence before invoicing.",
        rationale: [{ label: "0 evidence files" }],
      });
    }

    if (
      workOrder.current_status === "field_submitted_incomplete" ||
      workOrder.current_outcome_reason === "follow_up_required" ||
      workOrder.review_outcome === "follow_up_required"
    ) {
      out.push({
        key: recKey("billing_followup_needed", workOrder.id),
        type: "billing_followup_needed",
        severity: "warn",
        title: "Follow-up may be needed before closing",
        detail: "Job indicates further action — confirm before invoicing.",
        rationale: [
          { label: `Status: ${workOrder.current_status}` },
          ...(workOrder.current_outcome_reason
            ? [{ label: `Outcome reason: ${workOrder.current_outcome_reason}` }]
            : []),
          ...(workOrder.review_outcome
            ? [{ label: `Review outcome: ${workOrder.review_outcome}` }]
            : []),
        ],
      });
    }

    return out;
  }, [workOrder, billingCase, expenseCount, receiptCount, evidenceCount]);
}

// re-exports for nicer ergonomics
export type { RecommendationSuggestion };
export { suggestionExtra };