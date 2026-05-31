export type ExternalContactType = "tenant" | "landlord" | "agency" | "council" | "contractor" | "other";
export type CommunicationType = "call" | "email" | "note" | "visit" | "message" | "voicemail";
export type CommunicationDirection = "outbound" | "inbound";
export type FollowUpStatus =
  | "not_required"
  | "information_given"
  | "awaiting_response"
  | "follow_up_booked"
  | "unresolved"
  | "resolved";

export interface ExternalContact {
  id: string;
  name: string;
  organization: string | null;
  role_label: string | null;
  phone: string | null;
  email: string | null;
  contact_type: ExternalContactType;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface WorkOrderExternalContact {
  id: string;
  work_order_id: string;
  external_contact_id: string;
  relationship_label: string | null;
  is_primary: boolean;
  created_at: string;
  contact?: ExternalContact | null;
}

export interface CommunicationLogEntry {
  id: string;
  work_order_id: string;
  external_contact_id: string | null;
  logged_by_profile_id: string | null;
  communication_type: CommunicationType;
  direction: CommunicationDirection;
  occurred_at: string;
  subject: string | null;
  summary: string | null;
  outcome: FollowUpStatus;
  requires_follow_up: boolean;
  follow_up_due_at: string | null;
  follow_up_status: FollowUpStatus | null;
  follow_up_resolved_at: string | null;
  follow_up_resolved_by: string | null;
  created_at: string;
  updated_at: string;
  contact?: ExternalContact | null;
  logged_by?: { id: string; full_name: string | null; email: string } | null;
}

export interface NewCommunicationEntryInput {
  work_order_id: string;
  external_contact_id?: string | null;
  communication_type: CommunicationType;
  direction: CommunicationDirection;
  occurred_at?: string;
  subject?: string | null;
  summary?: string | null;
  outcome: FollowUpStatus;
  requires_follow_up: boolean;
  follow_up_due_at?: string | null;
  follow_up_status?: FollowUpStatus | null;
}

export const COMMUNICATION_TYPES: CommunicationType[] = [
  "call", "email", "note", "visit", "message", "voicemail",
];

export const FOLLOW_UP_STATUSES: FollowUpStatus[] = [
  "not_required", "information_given", "awaiting_response",
  "follow_up_booked", "unresolved", "resolved",
];

export const EXTERNAL_CONTACT_TYPES: ExternalContactType[] = [
  "tenant", "landlord", "agency", "council", "contractor", "other",
];