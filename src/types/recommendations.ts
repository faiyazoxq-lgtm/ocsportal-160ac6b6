export type RecommendationType =
  | "intake_categorization"
  | "intake_diary_ready"
  | "intake_duplicate"
  | "assignment_engineer"
  | "scheduling_slot"
  | "scheduling_duration"
  | "scheduling_coassign"
  | "billing_invoice_ready"
  | "billing_missing_evidence"
  | "billing_followup_needed";

export type RecommendationTargetType =
  | "intake_record"
  | "work_order"
  | "billing_case";

export type RecommendationSeverity = "info" | "suggest" | "warn";

export interface RecommendationRationaleItem {
  label: string;
  weight?: number;
  detail?: string;
}

export interface RecommendationRecord {
  id: string;
  recommendation_type: RecommendationType;
  target_record_type: RecommendationTargetType;
  target_record_id: string;
  recommendation_payload_json: Record<string, unknown>;
  confidence_score: number | null;
  rationale_json: RecommendationRationaleItem[];
  generated_at: string;
  dismissed_at: string | null;
  dismissed_by: string | null;
  acknowledged_at: string | null;
  acknowledged_by: string | null;
  created_at: string;
  updated_at: string;
}

/** Derived suggestion shape used by panels (not persisted). */
export interface RecommendationSuggestion {
  /** Stable client-side key so we can persist dismissal per recommendation+target. */
  key: string;
  type: RecommendationType;
  severity: RecommendationSeverity;
  title: string;
  detail?: string;
  rationale: RecommendationRationaleItem[];
  confidence?: number;
  payload?: Record<string, unknown>;
}