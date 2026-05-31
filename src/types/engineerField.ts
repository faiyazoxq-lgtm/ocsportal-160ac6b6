import type { IncompleteReason } from "./workOrders";

export interface ChecklistItem {
  key: string;
  label: string;
}

export const UNIVERSAL_CHECKLIST: ChecklistItem[] = [
  { key: "arrival_photo", label: "Arrival photo captured" },
  { key: "pre_work_condition", label: "Pre-work condition checked" },
  { key: "area_safe", label: "Work area assessed safe" },
  { key: "job_matched", label: "Job matches description" },
  { key: "additional_issue", label: "Additional issue found? (note in summary if yes)" },
  { key: "housekeeping", label: "Housekeeping / rubbish handled" },
  { key: "before_leaving_photo", label: "Before-leaving photo captured" },
  { key: "customer_signature", label: "Customer signature captured (if complete)" },
  { key: "advisory_note", label: "Advisory note added if needed" },
];

export const TRADE_CHECKLISTS: Record<string, ChecklistItem[]> = {
  plumbing: [
    { key: "isolation_valves_tested", label: "Isolation valves tested" },
    { key: "no_leaks_after", label: "No leaks after re-pressurise" },
    { key: "drain_down_recorded", label: "Drain-down recorded if applicable" },
  ],
  electrical: [
    { key: "circuit_isolated", label: "Circuit safely isolated" },
    { key: "polarity_tested", label: "Polarity & continuity tested" },
    { key: "rcd_test_recorded", label: "RCD test recorded" },
  ],
  gas: [
    { key: "gas_safe_id_shown", label: "Gas-Safe ID shown to customer" },
    { key: "tightness_test", label: "Tightness test completed" },
    { key: "co_alarm_checked", label: "CO alarm checked / advised" },
  ],
  heating: [
    { key: "system_bled", label: "System bled and re-pressurised" },
    { key: "rads_balanced", label: "Radiators balanced" },
    { key: "controls_explained", label: "Controls explained to customer" },
  ],
  drainage: [
    { key: "blockage_cleared", label: "Blockage cleared and flow restored" },
    { key: "cctv_if_needed", label: "CCTV inspection if required" },
    { key: "site_left_clean", label: "Site left clean and disinfected" },
  ],
  "multi-trade": [
    { key: "snag_items_addressed", label: "All snag items addressed" },
    { key: "fixings_secure", label: "Fixings / fittings secure" },
  ],
  refurbishment: [
    { key: "snag_items_addressed", label: "All snag items addressed" },
    { key: "finish_quality_checked", label: "Finish quality checked" },
    { key: "tools_collected", label: "All tools and materials collected" },
  ],
  "damp-mould": [
    { key: "moisture_reading", label: "Moisture reading recorded" },
    { key: "treatment_applied", label: "Treatment applied per spec" },
    { key: "ventilation_advised", label: "Ventilation advice given" },
  ],
};

export function getTradeChecklist(primaryTrade: string | null): ChecklistItem[] {
  if (!primaryTrade) return [];
  return TRADE_CHECKLISTS[primaryTrade] ?? [];
}

export const INCOMPLETE_REASONS: { value: IncompleteReason; label: string }[] = [
  { value: "insufficient_time", label: "Insufficient time" },
  { value: "insufficient_materials", label: "Insufficient materials" },
  { value: "unable_to_access", label: "Unable to access" },
  { value: "no_answer", label: "No answer" },
  { value: "tenant_refused", label: "Tenant refused" },
  { value: "unsafe_conditions", label: "Unsafe conditions" },
  { value: "additional_work_found", label: "Additional work found" },
  { value: "specialist_required", label: "Specialist required" },
  { value: "follow_up_required", label: "Follow-up required" },
  { value: "other", label: "Other" },
];