export type PersonKind = "app_user" | "external_contact";

export type AppRole = "boss" | "dispatcher" | "engineer";

export interface PersonRow {
  /** Stable row key combining kind + id. */
  key: string;
  kind: PersonKind;
  /** profiles.id when kind="app_user", external_contacts.id when kind="external_contact" */
  id: string;
  /** profiles.id — present only for app_user rows */
  profile_id: string | null;
  /** external_contacts.id — present only for external_contact rows */
  external_contact_id: string | null;

  display_name: string;
  email: string | null;
  phone: string | null;

  /** App role for app_user rows. */
  role: AppRole | null;
  /** Active/disabled for app_user rows. */
  is_active: boolean | null;

  /** External contact categorisation. */
  external_type: string | null;
  organization: string | null;
  role_label: string | null;
  notes: string | null;
  archived_at: string | null;

  /** Optional engineer profile fields (app_user + engineer role). */
  engineer?: {
    id: string;
    primary_trade: string | null;
    trade_tags: string[];
    covered_postcode_zones: string[];
    certification_tags?: string[];
    can_lead?: boolean;
    can_support?: boolean;
    complexity_cap?: "basic" | "intermediate" | "advanced";
    active_status?: boolean;
  } | null;

  created_at: string;
}

export type PersonFilterKind =
  | "all"
  | "staff"
  | "engineer"
  | "dispatcher"
  | "boss"
  | "external"
  | "active"
  | "disabled"
  | "archived";