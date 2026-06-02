import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type GlobalSearchResults = {
  workOrders: Array<{
    id: string;
    order_no: string;
    job_summary: string | null;
    current_status: string;
    address_line_1: string | null;
    city: string | null;
    postcode: string | null;
    client_name: string | null;
  }>;
  intakeRecords: Array<{
    id: string;
    source_type: string;
    source_reference: string | null;
    parse_status: string;
    created_at: string;
  }>;
  engineers: Array<{
    id: string;
    display_name: string;
    engineer_code: string | null;
    active_status: boolean;
  }>;
  externalContacts: Array<{
    id: string;
    name: string;
    organization: string | null;
    contact_type: string;
    email: string | null;
    phone: string | null;
  }>;
  billingCases: Array<{
    id: string;
    work_order_id: string;
    billing_status: string;
    invoice_reference: string | null;
    client_reference: string | null;
    order_no: string | null;
  }>;
  followUps: Array<{
    id: string;
    work_order_id: string;
    subject: string | null;
    summary: string | null;
    follow_up_status: string | null;
    communication_type: string;
  }>;
};

function esc(q: string) {
  // Escape PostgREST special chars used in or filters
  return q.replace(/[%,()*]/g, " ").trim();
}

export function useGlobalSearch(query: string) {
  const q = esc(query);
  const enabled = q.length >= 2;

  return useQuery({
    queryKey: ["global-search", q],
    enabled,
    staleTime: 15_000,
    queryFn: async (): Promise<GlobalSearchResults> => {
      const like = `%${q}%`;
      const limit = 8;

      const [wo, intake, eng, ext, bill, follow] = await Promise.all([
        supabase
          .from("work_orders")
          .select(
            "id, order_no, job_summary, current_status, address_line_1, city, postcode, client:clients(client_name)",
          )
          .or(
            `order_no.ilike.${like},job_summary.ilike.${like},address_line_1.ilike.${like},postcode.ilike.${like},city.ilike.${like}`,
          )
          .order("updated_at", { ascending: false })
          .limit(limit),
        supabase
          .from("intake_records")
          .select("id, source_type, source_reference, parse_status, created_at, raw_text")
          .or(`source_reference.ilike.${like},raw_text.ilike.${like}`)
          .order("created_at", { ascending: false })
          .limit(limit),
        supabase
          .from("engineers")
          .select("id, display_name, engineer_code, active_status")
          .or(`display_name.ilike.${like},engineer_code.ilike.${like}.ilike.${like}`)
          .limit(limit),
        supabase
          .from("external_contacts")
          .select("id, name, organization, contact_type, email, phone")
          .or(`name.ilike.${like},organization.ilike.${like},email.ilike.${like},phone.ilike.${like}`)
          .limit(limit),
        supabase
          .from("billing_cases")
          .select(
            "id, work_order_id, billing_status, invoice_reference, client_reference, work_order:work_orders(order_no)",
          )
          .or(`invoice_reference.ilike.${like},client_reference.ilike.${like}`)
          .order("updated_at", { ascending: false })
          .limit(limit),
        supabase
          .from("communication_log_entries")
          .select("id, work_order_id, subject, summary, follow_up_status, communication_type, requires_follow_up")
          .eq("requires_follow_up", true)
          .or(`subject.ilike.${like},summary.ilike.${like}`)
          .order("occurred_at", { ascending: false })
          .limit(limit),
      ]);

      return {
        workOrders: (wo.data ?? []).map((r: any) => ({
          id: r.id,
          order_no: r.order_no,
          job_summary: r.job_summary,
          current_status: r.current_status,
          address_line_1: r.address_line_1,
          city: r.city,
          postcode: r.postcode,
          client_name: r.client?.client_name ?? null,
        })),
        intakeRecords: (intake.data ?? []).map((r: any) => ({
          id: r.id,
          source_type: r.source_type,
          source_reference: r.source_reference,
          parse_status: r.parse_status,
          created_at: r.created_at,
        })),
        engineers: (eng.data ?? []) as GlobalSearchResults["engineers"],
        externalContacts: (ext.data ?? []) as GlobalSearchResults["externalContacts"],
        billingCases: (bill.data ?? []).map((r: any) => ({
          id: r.id,
          work_order_id: r.work_order_id,
          billing_status: r.billing_status,
          invoice_reference: r.invoice_reference,
          client_reference: r.client_reference,
          order_no: r.work_order?.order_no ?? null,
        })),
        followUps: (follow.data ?? []) as GlobalSearchResults["followUps"],
      };
    },
  });
}