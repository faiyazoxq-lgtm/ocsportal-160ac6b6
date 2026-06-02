import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface TenantContactRow {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  organization: string | null;
  notes: string | null;
  archived_at: string | null;
  created_at: string;
}

export function useTenantContacts() {
  return useQuery({
    queryKey: ["contacts", "tenants"],
    queryFn: async (): Promise<TenantContactRow[]> => {
      const { data, error } = await supabase
        .from("external_contacts")
        .select("id, name, phone, email, organization, notes, archived_at, created_at")
        .eq("contact_type", "tenant")
        .order("name", { ascending: true });
      if (error) throw error;
      return (data ?? []) as TenantContactRow[];
    },
  });
}