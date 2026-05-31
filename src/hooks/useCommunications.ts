import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import type {
  CommunicationLogEntry,
  ExternalContact,
  FollowUpStatus,
  NewCommunicationEntryInput,
  WorkOrderExternalContact,
  CommunicationType,
  ExternalContactType,
} from "@/types/communications";

const ENTRY_SELECT = `
  *,
  contact:external_contacts ( * ),
  logged_by:profiles!communication_log_entries_logged_by_profile_id_fkey ( id, full_name, email )
`;

// ---------- External contacts directory ----------

export function useExternalContacts(search?: string) {
  return useQuery({
    queryKey: ["external_contacts", search ?? ""],
    queryFn: async (): Promise<ExternalContact[]> => {
      let q = supabase
        .from("external_contacts")
        .select("*")
        .order("name", { ascending: true })
        .limit(200);
      if (search && search.trim()) {
        const s = `%${search.trim()}%`;
        q = q.or(`name.ilike.${s},organization.ilike.${s},email.ilike.${s},phone.ilike.${s}`);
      }
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as ExternalContact[];
    },
  });
}

export function useUpsertExternalContact() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: Partial<ExternalContact> & { name: string; contact_type: ExternalContactType }) => {
      const { data, error } = await supabase
        .from("external_contacts")
        .upsert(input as never, { onConflict: "id" })
        .select("*")
        .single();
      if (error) throw error;
      return data as ExternalContact;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["external_contacts"] }),
  });
}

// ---------- Work order ↔ contacts ----------

export function useWorkOrderContacts(workOrderId: string | null) {
  return useQuery({
    queryKey: ["wo_external_contacts", workOrderId],
    enabled: !!workOrderId,
    queryFn: async (): Promise<WorkOrderExternalContact[]> => {
      const { data, error } = await supabase
        .from("work_order_external_contacts")
        .select("*, contact:external_contacts(*)")
        .eq("work_order_id", workOrderId!)
        .order("is_primary", { ascending: false })
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as WorkOrderExternalContact[];
    },
  });
}

export function useLinkWorkOrderContact() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      work_order_id: string;
      external_contact_id: string;
      relationship_label?: string | null;
      is_primary?: boolean;
    }) => {
      const { data, error } = await supabase
        .from("work_order_external_contacts")
        .insert(input as never)
        .select("*, contact:external_contacts(*)")
        .single();
      if (error) throw error;
      return data as unknown as WorkOrderExternalContact;
    },
    onSuccess: (row) =>
      qc.invalidateQueries({ queryKey: ["wo_external_contacts", row.work_order_id] }),
  });
}

export function useUnlinkWorkOrderContact() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("work_order_external_contacts").delete().eq("id", id);
      if (error) throw error;
      return id;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["wo_external_contacts"] }),
  });
}

// ---------- Communication log entries ----------

export function useWorkOrderCommunications(workOrderId: string | null) {
  return useQuery({
    queryKey: ["wo_communications", workOrderId],
    enabled: !!workOrderId,
    queryFn: async (): Promise<CommunicationLogEntry[]> => {
      const { data, error } = await supabase
        .from("communication_log_entries")
        .select(ENTRY_SELECT)
        .eq("work_order_id", workOrderId!)
        .order("occurred_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as CommunicationLogEntry[];
    },
  });
}

export function useAddCommunicationEntry() {
  const qc = useQueryClient();
  const { profile } = useAuth();
  return useMutation({
    mutationFn: async (input: NewCommunicationEntryInput) => {
      const payload = {
        ...input,
        logged_by_profile_id: profile?.id ?? null,
        occurred_at: input.occurred_at ?? new Date().toISOString(),
        follow_up_status: input.requires_follow_up
          ? (input.follow_up_status ?? "awaiting_response")
          : null,
      };
      const { data, error } = await supabase
        .from("communication_log_entries")
        .insert(payload as never)
        .select(ENTRY_SELECT)
        .single();
      if (error) throw error;
      return data as unknown as CommunicationLogEntry;
    },
    onSuccess: (row) => {
      qc.invalidateQueries({ queryKey: ["wo_communications", row.work_order_id] });
      qc.invalidateQueries({ queryKey: ["follow_up_queue"] });
    },
  });
}

export function useUpdateFollowUpStatus() {
  const qc = useQueryClient();
  const { profile } = useAuth();
  return useMutation({
    mutationFn: async (input: { id: string; follow_up_status: FollowUpStatus }) => {
      const isResolved = input.follow_up_status === "resolved";
      const patch = {
        follow_up_status: input.follow_up_status,
        follow_up_resolved_at: isResolved ? new Date().toISOString() : null,
        follow_up_resolved_by: isResolved ? (profile?.id ?? null) : null,
        requires_follow_up: !isResolved,
      };
      const { data, error } = await supabase
        .from("communication_log_entries")
        .update(patch as never)
        .eq("id", input.id)
        .select(ENTRY_SELECT)
        .single();
      if (error) throw error;
      return data as unknown as CommunicationLogEntry;
    },
    onSuccess: (row) => {
      qc.invalidateQueries({ queryKey: ["wo_communications", row.work_order_id] });
      qc.invalidateQueries({ queryKey: ["follow_up_queue"] });
    },
  });
}

// ---------- Follow-up queue ----------

export interface FollowUpFilters {
  type?: CommunicationType | "all";
  status?: FollowUpStatus | "all";
  fromDate?: string | null;
  toDate?: string | null;
  contactType?: ExternalContactType | "all";
  loggedBy?: string | null;
  bucket?: "overdue" | "today" | "upcoming" | "unresolved" | "all";
}

export function useFollowUpQueue(filters: FollowUpFilters = {}) {
  return useQuery({
    queryKey: ["follow_up_queue", filters],
    queryFn: async () => {
      let q = supabase
        .from("communication_log_entries")
        .select(`${ENTRY_SELECT}, work_order:work_orders ( id, order_no, job_summary, postcode, current_status )`)
        .eq("requires_follow_up", true)
        .order("follow_up_due_at", { ascending: true, nullsFirst: false })
        .limit(500);

      if (filters.type && filters.type !== "all") q = q.eq("communication_type", filters.type);
      if (filters.status && filters.status !== "all") q = q.eq("follow_up_status", filters.status);
      if (filters.fromDate) q = q.gte("occurred_at", filters.fromDate);
      if (filters.toDate) q = q.lte("occurred_at", filters.toDate);
      if (filters.loggedBy) q = q.eq("logged_by_profile_id", filters.loggedBy);

      const now = new Date();
      const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
      const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59).toISOString();
      if (filters.bucket === "overdue") q = q.lt("follow_up_due_at", startOfToday);
      else if (filters.bucket === "today")
        q = q.gte("follow_up_due_at", startOfToday).lte("follow_up_due_at", endOfToday);
      else if (filters.bucket === "upcoming") q = q.gt("follow_up_due_at", endOfToday);
      else if (filters.bucket === "unresolved") q = q.in("follow_up_status", ["awaiting_response", "unresolved"]);

      const { data, error } = await q;
      if (error) throw error;
      let rows = (data ?? []) as unknown as Array<
        CommunicationLogEntry & { work_order: { id: string; order_no: string; job_summary: string | null; postcode: string | null; current_status: string } | null }
      >;
      if (filters.contactType && filters.contactType !== "all") {
        rows = rows.filter((r) => r.contact?.contact_type === filters.contactType);
      }
      return rows;
    },
  });
}