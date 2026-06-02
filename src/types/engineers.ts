import type { ComplexityLevel, AssignmentRole, AssignmentStatus } from "./workOrders";

export interface Engineer {
  id: string;
  profile_id: string | null;
  display_name: string;
  engineer_code: string | null;
  primary_trade: string | null;
  trade_tags: string[];
  certification_tags: string[];
  covered_postcode_zones: string[];
  complexity_cap: ComplexityLevel;
  can_lead: boolean;
  can_support: boolean;
  active_status: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
  personal_email?: string | null;
  contact_number?: string | null;
  hourly_pay_rate?: number | null;
  van_registration?: string | null;
  avatar_url?: string | null;
}

export type AvailabilityType = "working_hours" | "time_off" | "unavailable_block";

export interface EngineerAvailability {
  id: string;
  engineer_id: string;
  availability_type: AvailabilityType;
  start_at: string | null;
  end_at: string | null;
  weekday_rule: string | null;
  note: string | null;
  created_by: string | null;
  created_at: string;
}

export interface EngineerAvailabilityInput {
  engineer_id: string;
  availability_type: AvailabilityType;
  start_at?: string | null;
  end_at?: string | null;
  weekday_rule?: string | null;
  note?: string | null;
}

export interface EngineerInput {
  display_name: string;
  engineer_code?: string | null;
  primary_trade?: string | null;
  trade_tags: string[];
  certification_tags: string[];
  covered_postcode_zones: string[];
  complexity_cap: ComplexityLevel;
  can_lead: boolean;
  can_support: boolean;
  active_status: boolean;
  notes?: string | null;
  personal_email?: string | null;
  contact_number?: string | null;
  hourly_pay_rate?: number | null;
  van_registration?: string | null;
  avatar_url?: string | null;
}

export interface WorkOrderAssignment {
  id: string;
  work_order_id: string;
  engineer_id: string;
  assignment_role: AssignmentRole;
  assignment_status: AssignmentStatus;
  rejection_reason: string | null;
  assigned_by: string | null;
  assigned_at: string;
  updated_at: string;
}