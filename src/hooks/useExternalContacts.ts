import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface ExternalContactRow {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  organization: string | null;
  contact_type: string | null;
  notes: string | null;
  archived_at: string | null;
  created_at: string;
}

/**
 * External contacts excluding tenants (tenants live in the Clients tab).
 */
export function useExternalContacts() {
  return useQuery({
    queryKey: ["contacts", "external", "non-tenant"],
    queryFn: async (): Promise<ExternalContactRow[]> => {
      const { data, error } = await supabase
        .from("external_contacts")
        .select("id, name, phone, email, organization, contact_type, notes, archived_at, created_at")
        .neq("contact_type", "tenant")
        .order("name", { ascending: true });
      if (error) throw error;
      return (data ?? []) as ExternalContactRow[];
    },
  });
}