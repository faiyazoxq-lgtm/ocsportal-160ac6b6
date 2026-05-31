export type BillingStatus =
  | "pending_review"
  | "ready_to_invoice"
  | "invoiced"
  | "on_hold"
  | "rejected";

export const BILLING_STATUSES: BillingStatus[] = [
  "pending_review",
  "ready_to_invoice",
  "invoiced",
  "on_hold",
  "rejected",
];

export const BILLING_STATUS_LABEL: Record<BillingStatus, string> = {
  pending_review: "Pending review",
  ready_to_invoice: "Ready to invoice",
  invoiced: "Invoiced",
  on_hold: "On hold",
  rejected: "Rejected",
};

export interface BillingCase {
  id: string;
  work_order_id: string;
  billing_status: BillingStatus;
  invoice_reference: string | null;
  client_reference: string | null;
  labour_summary: string | null;
  materials_summary: string | null;
  expense_total: number | null;
  billable_total: number | null;
  non_billable_reason: string | null;
  billing_notes: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  exported_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface BillingAdjustment {
  id: string;
  billing_case_id: string;
  adjustment_type: string;
  amount: number | null;
  note: string | null;
  created_by: string | null;
  created_at: string;
}

export interface BillingStatusEvent {
  id: string;
  billing_case_id: string;
  from_status: BillingStatus | null;
  to_status: BillingStatus;
  note: string | null;
  actor_profile_id: string | null;
  created_at: string;
}

// Work order statuses that are eligible for billing prep
export const BILLING_ELIGIBLE_STATUSES = [
  "field_submitted_complete",
  "field_submitted_incomplete",
  "dispatcher_review",
  "follow_up_required",
  "closed",
] as const;