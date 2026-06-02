export type EngineerPermissionCategoryId =
  | "contact_info"
  | "work_order_info"
  | "communications"
  | "directory";

export interface EngineerPermissionToggleDef {
  key: string;
  label: string;
  description: string;
  defaultValue: boolean;
}

export interface EngineerPermissionCategoryDef {
  id: EngineerPermissionCategoryId;
  title: string;
  description: string;
  toggles: readonly EngineerPermissionToggleDef[];
}

export const ENGINEER_PERMISSION_CATEGORIES: readonly EngineerPermissionCategoryDef[] = [
  {
    id: "contact_info",
    title: "Contact info",
    description: "Phone numbers, emails and other personal details engineers can see on a job.",
    toggles: [
      { key: "see_client_phone", label: "Client phone", description: "Show the agency/client contact phone number.", defaultValue: true },
      { key: "see_client_email", label: "Client email", description: "Show the agency/client contact email.", defaultValue: true },
      { key: "see_tenant_phone", label: "Tenant phone", description: "Show the tenant's phone number on the job.", defaultValue: true },
      { key: "see_tenant_email", label: "Tenant email", description: "Show the tenant's email on the job.", defaultValue: true },
      { key: "see_other_engineer_contact", label: "Other engineers' contact details", description: "Show phone/email of other engineers in the directory.", defaultValue: false },
    ],
  },
  {
    id: "work_order_info",
    title: "Work order info",
    description: "Commercial and dispatch-only fields on the work order.",
    toggles: [
      { key: "see_spend_limit", label: "Spend limit cap", description: "Show the spend limit cap exc VAT on the job.", defaultValue: false },
      { key: "see_agency_details", label: "Agency / client details", description: "Show the agency / client block on the job.", defaultValue: true },
      { key: "see_tenant_details", label: "Tenant details", description: "Show the tenant details block on the job.", defaultValue: true },
      { key: "see_billing_notes", label: "Billing notes", description: "Show billing notes attached to the work order.", defaultValue: false },
      { key: "see_full_address_pre_assignment", label: "Full address before assignment", description: "Show the full street address on jobs not yet assigned to the engineer.", defaultValue: false },
    ],
  },
  {
    id: "communications",
    title: "Communications",
    description: "Logged calls, messages and attached files visible on a job.",
    toggles: [
      { key: "see_communication_log", label: "Communication log", description: "Show the call/email history thread on the job.", defaultValue: true },
      { key: "see_attachments", label: "Job attachments", description: "Show dispatcher-uploaded files attached to the job.", defaultValue: true },
    ],
  },
  {
    id: "directory",
    title: "Directory access",
    description: "Which Contacts tabs engineers can browse.",
    toggles: [
      { key: "see_contacts_directory", label: "Contacts page", description: "Allow engineers to open the Contacts page at all.", defaultValue: true },
      { key: "see_client_list", label: "Client List tab", description: "Allow engineers to browse the tenant/client list.", defaultValue: false },
      { key: "see_external_contacts", label: "External Contacts tab", description: "Allow engineers to browse external suppliers and agencies.", defaultValue: false },
    ],
  },
] as const;

export type EngineerPermissions = Record<
  EngineerPermissionCategoryId,
  Record<string, boolean>
>;

export function defaultEngineerPermissions(): EngineerPermissions {
  const out = {} as EngineerPermissions;
  for (const cat of ENGINEER_PERMISSION_CATEGORIES) {
    out[cat.id] = {};
    for (const t of cat.toggles) out[cat.id][t.key] = t.defaultValue;
  }
  return out;
}

/** Merge stored permissions with defaults so missing keys fall back safely. */
export function mergeEngineerPermissions(
  stored: Partial<EngineerPermissions> | null | undefined,
): EngineerPermissions {
  const base = defaultEngineerPermissions();
  if (!stored) return base;
  for (const cat of ENGINEER_PERMISSION_CATEGORIES) {
    const incoming = stored[cat.id];
    if (incoming && typeof incoming === "object") {
      base[cat.id] = { ...base[cat.id], ...incoming };
    }
  }
  return base;
}