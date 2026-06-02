import type { PlannerRow } from "@/services/googleSheetsSync.server";

export const PLANNER_PULLABLE_FIELDS = ["diary_date", "diary_slot", "admin_notes"] as const;

export type PlannerSourceWorkOrder = {
  id: string;
  order_no: string;
  address_line_1: string | null;
  address_line_2: string | null;
  city: string | null;
  postcode: string | null;
  postcode_zone: string | null;
  priority_level: string;
  diary_date: string | null;
  diary_slot_label: string | null;
  engineers_required: number;
  current_status: string;
  review_outcome: string | null;
  duplicate_flag: boolean;
  admin_notes: string | null;
  client?: { client_name: string | null } | null;
  assignments?: Array<{
    assignment_role: string;
    assignment_status: string;
    engineer?: { display_name: string | null } | null;
  }> | null;
};

export function buildPlannerRow(wo: PlannerSourceWorkOrder): PlannerRow {
  const address = [wo.address_line_1, wo.address_line_2, wo.city]
    .filter(Boolean)
    .join(", ");
  const active = (wo.assignments ?? []).filter(
    (a) => a.assignment_status !== "removed" && a.assignment_status !== "rejected",
  );
  const lead =
    active.find((a) => a.assignment_role === "lead")?.engineer?.display_name ?? "";
  const support = active
    .filter((a) => a.assignment_role === "support")
    .map((a) => a.engineer?.display_name)
    .filter(Boolean)
    .join(", ");

  const notes = (wo.admin_notes ?? "").replace(/\s+/g, " ").trim();
  const truncatedNotes = notes.length > 240 ? `${notes.slice(0, 237)}…` : notes;

  return {
    order_no: wo.order_no,
    client_name: wo.client?.client_name ?? "",
    address,
    postcode: wo.postcode ?? "",
    postcode_zone: wo.postcode_zone ?? "",
    complexity: null ?? "",
    priority: wo.priority_level,
    diary_date: wo.diary_date ?? "",
    diary_slot: wo.diary_slot_label ?? "",
    lead_engineer: lead,
    support_engineers: support,
    engineers_required: String(wo.engineers_required ?? 1),
    current_status: wo.current_status,
    review_outcome: wo.review_outcome ?? "",
    duplicate_flag: wo.duplicate_flag ? "yes" : "",
    admin_notes: truncatedNotes,
  };
}

export async function hashRow(row: PlannerRow): Promise<string> {
  const stable = JSON.stringify(row, Object.keys(row).sort());
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(stable));
  const bytes = new Uint8Array(buf);
  let hex = "";
  for (let i = 0; i < bytes.length; i++) hex += bytes[i].toString(16).padStart(2, "0");
  return hex;
}