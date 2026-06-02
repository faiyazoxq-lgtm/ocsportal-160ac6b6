import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type {
  WorkOrderStatus,
  WorkOrderWithRelations,
  IncompleteReason,
  ClientType,
} from "@/types/workOrders";

const WO_SELECT = `
  *,
  client:clients ( id, client_name, client_type, contact_name, contact_phone ),
  assignments:work_order_assignments (
    id, assignment_role, assignment_status,
    engineer:engineers ( id, display_name, engineer_code, primary_trade )
  )
`;

export interface CurrentEngineer {
  id: string;
  display_name: string;
  engineer_code: string | null;
}

export function useCurrentEngineer() {
  return useQuery({
    queryKey: ["engineer", "me"],
    queryFn: async (): Promise<CurrentEngineer | null> => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return null;
      const { data, error } = await supabase
        .from("engineers")
        .select("id, display_name, engineer_code")
        .eq("profile_id", u.user.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

type EngineerClient = {
  id: string;
  client_name: string;
  client_type: ClientType;
  contact_name: string | null;
  contact_phone: string | null;
};

export type EngineerJobView = Omit<WorkOrderWithRelations, "client"> & {
  client: EngineerClient | null;
};

export interface EngineerJobDetail extends EngineerJobView {
  events: Array<{
    id: string;
    event_type: string;
    event_label: string | null;
    event_payload_json: Record<string, unknown>;
    created_at: string;
  }>;
}

export function useEngineerAssignedJobs() {
  return useQuery({
    queryKey: ["engineer", "jobs"],
    queryFn: async (): Promise<EngineerJobView[]> => {
      const { data, error } = await supabase
        .from("work_orders")
        .select(WO_SELECT)
        .order("diary_date", { ascending: true, nullsFirst: false })
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data ?? []) as unknown as EngineerJobView[];
    },
  });
}

export function useEngineerJobDetail(id: string | null) {
  return useQuery({
    queryKey: ["engineer", "jobs", "detail", id],
    enabled: !!id,
    queryFn: async (): Promise<EngineerJobDetail | null> => {
      if (!id) return null;
      const [{ data: wo, error: woErr }, { data: events, error: evErr }] =
        await Promise.all([
          supabase.from("work_orders").select(WO_SELECT).eq("id", id).maybeSingle(),
          supabase
            .from("work_order_events")
            .select("id, event_type, event_label, event_payload_json, created_at")
            .eq("work_order_id", id)
            .order("created_at", { ascending: false })
            .limit(100),
        ]);
      if (woErr) throw woErr;
      if (evErr) throw evErr;
      if (!wo) return null;
      return {
        ...(wo as unknown as EngineerJobView),
        events: (events ?? []) as EngineerJobDetail["events"],
      };
    },
  });
}

async function logEvent(params: {
  work_order_id: string;
  event_type: string;
  event_label: string;
  payload?: Record<string, unknown>;
}) {
  const { error } = await supabase.from("work_order_events").insert({
    work_order_id: params.work_order_id,
    event_type: params.event_type,
    event_label: params.event_label,
    event_payload_json: (params.payload ?? {}) as never,
  });
  if (error) throw error;
}

async function updateStatus(
  id: string,
  status: WorkOrderStatus,
  extra?: Record<string, unknown>,
) {
  const { error } = await supabase
    .from("work_orders")
    .update({ current_status: status, ...(extra ?? {}) })
    .eq("id", id);
  if (error) throw error;
}

export type FieldMilestone = "en_route" | "on_site" | "field_in_progress";

const MILESTONE_LABEL: Record<FieldMilestone, string> = {
  en_route: "Engineer on route",
  on_site: "Engineer arrived on site",
  field_in_progress: "Work in progress",
};

export function useEngineerFieldActions(workOrderId: string) {
  const qc = useQueryClient();

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["engineer", "jobs"] });
    qc.invalidateQueries({ queryKey: ["engineer", "jobs", "detail", workOrderId] });
    qc.invalidateQueries({ queryKey: ["work_orders"] });
  };

  const milestone = useMutation({
    mutationFn: async (m: FieldMilestone) => {
      await updateStatus(workOrderId, m);
      await logEvent({
        work_order_id: workOrderId,
        event_type: "milestone",
        event_label: MILESTONE_LABEL[m],
        payload: { milestone: m },
      });
    },
    onSuccess: invalidate,
  });

  const submitOutcome = useMutation({
    mutationFn: async (input: {
      outcome: "complete" | "incomplete";
      reason: IncompleteReason | null;
      notes: string;
      checklist: Record<string, boolean>;
      evidence: { arrival: boolean; before_leaving: boolean; signature: boolean };
    }) => {
      const newStatus: WorkOrderStatus =
        input.outcome === "complete"
          ? "field_submitted_complete"
          : "field_submitted_incomplete";
      await updateStatus(workOrderId, newStatus, {
        current_outcome_reason:
          input.outcome === "incomplete" ? input.reason : null,
      });
      await logEvent({
        work_order_id: workOrderId,
        event_type: "field_submit",
        event_label:
          input.outcome === "complete"
            ? "Engineer submitted job as complete"
            : "Engineer submitted job as incomplete",
        payload: {
          outcome: input.outcome,
          reason: input.reason,
          notes: input.notes,
          checklist: input.checklist,
          evidence: input.evidence,
        },
      });
    },
    onSuccess: invalidate,
  });

  return { milestone, submitOutcome };
}

export interface EngineerEditableFields {
  job_summary: string | null;
  job_description: string | null;
  tools_materials_hint: string | null;
  address_line_1: string | null;
  address_line_2: string | null;
  city: string | null;
  postcode: string | null;
}

/**
 * Engineer-side update for an assigned work order. RLS already restricts
 * writes to lead engineers via the "Lead engineers update assigned work
 * orders" policy, so this only widens the UI surface, not the permissions.
 * Invalidates every key that renders work-order rows so the change is
 * reflected everywhere it appears in the app.
 */
export function useUpdateEngineerWorkOrder(workOrderId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (patch: Partial<EngineerEditableFields>) => {
      const { error } = await supabase
        .from("work_orders")
        .update(patch)
        .eq("id", workOrderId);
      if (error) throw error;
      await supabase.from("work_order_events").insert({
        work_order_id: workOrderId,
        event_type: "engineer_edit",
        event_label: "Engineer updated work order details",
        event_payload_json: { fields: Object.keys(patch) } as never,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["engineer", "jobs"] });
      qc.invalidateQueries({
        queryKey: ["engineer", "jobs", "detail", workOrderId],
      });
      qc.invalidateQueries({ queryKey: ["work_orders"] });
      qc.invalidateQueries({ queryKey: ["work_orders", "detail", workOrderId] });
      qc.invalidateQueries({ queryKey: ["work_order_documents", workOrderId] });
    },
  });
}
