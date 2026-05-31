import type { Database } from "@/integrations/supabase/types";

export type NotificationType = Database["public"]["Enums"]["notification_type"];
export type NotificationSeverity = Database["public"]["Enums"]["notification_severity"];
export type NotificationDeliveryStatus =
  Database["public"]["Enums"]["notification_delivery_status"];

export type NotificationRow =
  Database["public"]["Tables"]["notifications"]["Row"];

export type NotificationPreferencesRow =
  Database["public"]["Tables"]["notification_preferences"]["Row"];

export const NOTIFICATION_TYPE_LABEL: Record<NotificationType, string> = {
  intake_review_required: "Intake needs review",
  duplicate_suspected: "Duplicate suspected",
  work_order_assigned: "Job assigned",
  work_order_reassigned: "Job reassigned",
  diary_changed: "Diary changed",
  engineer_rejected: "Engineer rejected job",
  job_completed: "Job complete",
  job_incomplete: "Job incomplete",
  sync_failed: "Sync failed",
  sync_recovered: "Sync recovered",
  planner_conflict: "Planner conflict",
  overdue_follow_up: "Overdue follow-up",
  billing_ready: "Billing ready",
  billing_on_hold: "Billing on hold",
};

/** Which notification types apply to which role — used to keep the prefs UI focused. */
export const ROLE_RELEVANT_TYPES: Record<"dispatcher" | "engineer" | "boss", NotificationType[]> = {
  dispatcher: [
    "intake_review_required",
    "duplicate_suspected",
    "engineer_rejected",
    "job_completed",
    "job_incomplete",
    "planner_conflict",
    "overdue_follow_up",
    "billing_ready",
    "billing_on_hold",
    "sync_failed",
    "sync_recovered",
  ],
  engineer: [
    "work_order_assigned",
    "work_order_reassigned",
    "diary_changed",
    "sync_failed",
    "sync_recovered",
  ],
};