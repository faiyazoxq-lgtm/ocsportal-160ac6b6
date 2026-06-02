import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Upsert a tenant external_contact and link it to the work order.
 * Reuses an existing tenant contact when name + phone (or email) match,
 * otherwise inserts a new one and stores the id back on the work order.
 */
export function useUpsertTenantContact() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      workOrderId: string;
      name: string;
      phone?: string | null;
      email?: string | null;
      notes?: string | null;
    }) => {
      const name = input.name.trim();
      if (!name) throw new Error("Tenant name is required to save a contact.");

      const { data: u } = await supabase.auth.getUser();
      const userId = u.user?.id ?? null;

      // Try to find an existing tenant contact with matching name + phone/email
      let existingId: string | null = null;
      const { data: matches } = await supabase
        .from("external_contacts")
        .select("id, name, phone, email")
        .eq("contact_type", "tenant")
        .ilike("name", name)
        .limit(20);
      if (matches && matches.length) {
        const phone = input.phone?.trim() ?? "";
        const email = input.email?.trim().toLowerCase() ?? "";
        const hit = matches.find(
          (m) =>
            (phone && (m.phone ?? "").replace(/\s+/g, "") === phone.replace(/\s+/g, "")) ||
            (email && (m.email ?? "").toLowerCase() === email),
        );
        existingId = hit?.id ?? null;
      }

      let tenantContactId = existingId;
      if (!tenantContactId) {
        const { data: inserted, error: insErr } = await supabase
          .from("external_contacts")
          .insert({
            name,
            phone: input.phone?.trim() || null,
            email: input.email?.trim() || null,
            notes: input.notes?.trim() || null,
            contact_type: "tenant",
            created_by: userId,
          })
          .select("id")
          .single();
        if (insErr) throw insErr;
        tenantContactId = inserted.id;
      }

      const { error: updErr } = await supabase
        .from("work_orders")
        .update({ tenant_contact_id: tenantContactId })
        .eq("id", input.workOrderId);
      if (updErr) throw updErr;

      return tenantContactId;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["work_orders"] });
      qc.invalidateQueries({ queryKey: ["contacts", "tenants"] });
    },
  });
}