export type IntakeState =
  | "received"
  | "parsing"
  | "parsed"
  | "needs_review"
  | "duplicate_suspected"
  | "approved"
  | "rejected"
  | "converted";

export type IntakeSourceType = "email" | "webhook" | "upload" | "manual";

export type IntakeCaptureStatus =
  | "captured"
  | "queued"
  | "parsing"
  | "parsed"
  | "failed";

export interface IntakeExtractedFields {
  order_no?: string | null;
  client_id?: string | null;
  client_name?: string | null;
  address_line_1?: string | null;
  city?: string | null;
  postcode?: string | null;
  postcode_zone?: string | null;
  job_summary?: string | null;
  job_description?: string | null;
  contact_name?: string | null;
  contact_phone?: string | null;
}

export interface IntakeSuggestedCategorization {
  client_id?: string | null;
  primary_trade?: string | null;
  complexity_level?: "basic" | "intermediate" | "advanced" | null;
  priority_level?: "low" | "normal" | "high" | "urgent" | null;
  postcode_zone?: string | null;
  engineers_required?: number | null;
  diary_ready?: boolean | null;
}

export interface IntakeDuplicateCandidate {
  work_order_id: string;
  order_no: string;
  reason: string;
  score: number;
}

export interface IntakeRecord {
  id: string;
  source_type: IntakeSourceType;
  source_reference: string | null;
  source_file_path: string | null;
  source_bucket: string | null;
  source_sender: string | null;
  source_subject: string | null;
  received_at: string;
  original_filename: string | null;
  original_mime_type: string | null;
  original_byte_size: number | null;
  capture_status: IntakeCaptureStatus;
  parsing_queued_at: string | null;
  parsing_started_at: string | null;
  parsing_completed_at: string | null;
  raw_text: string | null;
  raw_payload_json: Record<string, unknown>;
  extracted_fields_json: IntakeExtractedFields;
  suggested_categorization_json: IntakeSuggestedCategorization;
  missing_fields_json: string[];
  parsing_issues_json: string[];
  duplicate_candidates_json: IntakeDuplicateCandidate[];
  parse_status: IntakeState;
  parse_confidence: number | null;
  duplicate_confidence: number | null;
  categorization_confidence: number | null;
  suggested_work_order_id: string | null;
  converted_work_order_id: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  rejection_reason: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface ParsingReviewAction {
  id: string;
  intake_record_id: string;
  reviewer_profile_id: string | null;
  action_type: string;
  previous_values_json: Record<string, unknown>;
  next_values_json: Record<string, unknown>;
  note: string | null;
  created_at: string;
}

export const INTAKE_REVIEW_STATES: IntakeState[] = [
  "received",
  "parsing",
  "parsed",
  "needs_review",
  "duplicate_suspected",
  "approved",
];