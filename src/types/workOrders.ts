export type WorkOrderStatus =
  | "ingested"
  | "parsing_in_progress"
  | "admin_attention"
  | "parsed_ready"
  | "categorized"
  | "ready_for_dispatch"
  | "scheduled_in_sheet"
  | "assigned"
  | "accepted"
  | "en_route"
  | "on_site"
  | "field_in_progress"
  | "field_submitted_complete"
  | "field_submitted_incomplete"
  | "dispatcher_review"
  | "follow_up_required"
  | "closed"
  | "cancelled"
  | "duplicate_flagged"
  | "ignored";

export type ComplexityLevel = "basic" | "intermediate" | "advanced";
export type PriorityLevel = "low" | "normal" | "high" | "urgent";
export type SourceChannel = "email" | "pdf_upload" | "manual_entry" | "webhook";
export type ClientType = "council" | "agency" | "landlord" | "private";
export type AssignmentRole = "lead" | "support";
export type AssignmentStatus = "assigned" | "accepted" | "rejected" | "removed";
export type IncompleteReason =
  | "insufficient_time"
  | "insufficient_materials"
  | "unable_to_access"
  | "no_answer"
  | "tenant_refused"
  | "unsafe_conditions"
  | "additional_work_found"
  | "specialist_required"
  | "follow_up_required"
  | "other";
export type ReviewOutcome =
  | "closed"
  | "follow_up_required"
  | "further_quote_needed"
  | "client_update_required"
  | "duplicate_confirmed"
  | "cancelled";

export interface Client {
  id: string;
  client_name: string;
  client_type: ClientType;
  contact_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  billing_notes: string | null;
  active: boolean;
  created_at: string;
}

export interface Engineer {
  id: string;
  display_name: string;
  engineer_code: string | null;
  primary_trade: string | null;
}

export interface WorkOrder {
  id: string;
  order_no: string;
  client_id: string | null;
  source_channel: SourceChannel;
  parsing_confidence: number | null;
  categorization_confidence: number | null;
  duplicate_flag: boolean;
  address_line_1: string | null;
  address_line_2: string | null;
  city: string | null;
  postcode: string | null;
  postcode_zone: string | null;
  latitude: number | null;
  longitude: number | null;
  job_summary: string | null;
  job_description: string | null;
  primary_trade: string | null;
  trade_tags: string[];
  complexity_level: ComplexityLevel | null;
  certification_tags: string[];
  estimated_duration_minutes: number | null;
  estimated_value_amount: number | null;
  priority_level: PriorityLevel;
  engineers_required: number;
  tools_materials_hint: string | null;
  current_status: WorkOrderStatus;
  current_outcome_reason: IncompleteReason | null;
  diary_date: string | null;
  diary_slot_label: string | null;
  review_outcome: ReviewOutcome | null;
  admin_notes: string | null;
  field_lock_active: boolean;
  field_lock_started_at: string | null;
  active_editor_engineer_id: string | null;
  pending_sync_flag: boolean;
  last_synced_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface WorkOrderWithRelations extends WorkOrder {
  client: Pick<Client, "id" | "client_name" | "client_type"> | null;
  assignments: Array<{
    id: string;
    assignment_role: AssignmentRole;
    assignment_status: AssignmentStatus;
    engineer: Pick<Engineer, "id" | "display_name" | "engineer_code"> | null;
  }>;
}

export interface ParsingReview {
  id: string;
  work_order_id: string;
  issue_type: string;
  issue_summary: string | null;
  missing_fields_json: string[];
  confidence_snapshot_json: Record<string, number>;
  review_status: string;
  resolved_by: string | null;
  resolved_at: string | null;
  created_at: string;
}

export const INTAKE_STATUSES: WorkOrderStatus[] = [
  "ingested",
  "parsing_in_progress",
  "parsed_ready",
  "categorized",
];

export const ATTENTION_STATUSES: WorkOrderStatus[] = [
  "admin_attention",
  "parsing_in_progress",
];

export const DISPATCH_STATUSES: WorkOrderStatus[] = [
  "ready_for_dispatch",
  "scheduled_in_sheet",
  "assigned",
  "accepted",
];

export const REVIEW_STATUSES: WorkOrderStatus[] = [
  "dispatcher_review",
  "follow_up_required",
  "field_submitted_incomplete",
  "field_submitted_complete",
];