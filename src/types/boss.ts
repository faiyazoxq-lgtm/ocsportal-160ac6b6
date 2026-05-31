export type BossAuditActionType =
  | "account_created"
  | "account_disabled"
  | "account_reactivated"
  | "password_reset_initiated"
  | "role_changed"
  | "profile_edited"
  | "job_edited"
  | "status_overridden"
  | "job_reopened"
  | "record_force_unlocked"
  | "assignment_overridden";

export interface BossAuditEntry {
  id: string;
  created_at: string;
  actor_profile_id: string;
  action_type: string;
  target_type: string | null;
  target_id: string | null;
  reason: string | null;
  before_json: Record<string, unknown>;
  after_json: Record<string, unknown>;
  context_json: Record<string, unknown>;
}

export interface BossStaffRow {
  id: string;
  email: string;
  full_name: string | null;
  phone: string | null;
  work_email: string | null;
  role: "boss" | "dispatcher" | "engineer";
  is_active: boolean;
  disabled_at: string | null;
  password_reset_requested_at: string | null;
  created_at: string;
}

export const BOSS_ACTION_LABEL: Record<string, string> = {
  account_created: "Account created",
  account_disabled: "Account disabled",
  account_reactivated: "Account reactivated",
  password_reset_initiated: "Password reset initiated",
  role_changed: "Role changed",
  profile_edited: "Profile edited",
  job_edited: "Job edited",
  status_overridden: "Status overridden",
  job_reopened: "Job reopened",
  record_force_unlocked: "Record force-unlocked",
  assignment_overridden: "Assignment overridden",
};