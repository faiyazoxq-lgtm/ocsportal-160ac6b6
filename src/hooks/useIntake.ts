import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type {
  IntakeRecord,
  IntakeState,
  IntakeExtractedFields,
  IntakeSuggestedCategorization,
  ParsingReviewAction,
} from "@/types/intake";

const TABLE = "intake_records" as const;
const ACTIONS_TABLE = "parsing_review_actions" as const;

export function useIntakeQueue(states?: IntakeState[]) {
  return useQuery({
    queryKey: ["intake_records", states?.join(",") ?? "all"],
    queryFn: async (): Promise<IntakeRecord[]> => {
      let q = supabase.from(TABLE).select("*").order("created_at", { ascending: false }).limit(200);
      if (states && states.length) q = q.in("parse_status", states);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as unknown as IntakeRecord[];
    },
  });
}

export function useIntakeRecord(id: string | null) {
  return useQuery({
    queryKey: ["intake_records", "detail", id],
    enabled: !!id,
    queryFn: async (): Promise<IntakeRecord | null> => {
      if (!id) return null;
      const { data, error } = await supabase.from(TABLE).select("*").eq("id", id).maybeSingle();
      if (error) throw error;
      return (data as unknown as IntakeRecord) ?? null;
    },
  });
}

export function useParsingReviewHistory(intakeId: string | null) {
  return useQuery({
    queryKey: ["parsing_review_actions", intakeId],
    enabled: !!intakeId,
    queryFn: async (): Promise<ParsingReviewAction[]> => {
      if (!intakeId) return [];
      const { data, error } = await supabase
        .from(ACTIONS_TABLE)
        .select("*")
        .eq("intake_record_id", intakeId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as ParsingReviewAction[];
    },
  });
}

async function logAction(
  intakeId: string,
  actionType: string,
  prev: Record<string, unknown>,
  next: Record<string, unknown>,
  note?: string,
) {
  const { data: u } = await supabase.auth.getUser();
  await supabase.from(ACTIONS_TABLE).insert({
    intake_record_id: intakeId,
    reviewer_profile_id: u.user?.id ?? null,
    action_type: actionType,
    previous_values_json: prev as never,
    next_values_json: next as never,
    note: note ?? null,
  });
}

export function useUpdateIntakeFields() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: {
      id: string;
      extracted: IntakeExtractedFields;
      categorization: IntakeSuggestedCategorization;
      prev: IntakeRecord;
    }) => {
      const { error } = await supabase
        .from(TABLE)
        .update({
          extracted_fields_json: args.extracted as never,
          suggested_categorization_json: args.categorization as never,
        })
        .eq("id", args.id);
      if (error) throw error;
      await logAction(
        args.id,
        "edit_fields",
        {
          extracted: args.prev.extracted_fields_json,
          categorization: args.prev.suggested_categorization_json,
        },
        { extracted: args.extracted, categorization: args.categorization },
      );
    },
    onSuccess: (_, v) => {
      qc.invalidateQueries({ queryKey: ["intake_records"] });
      qc.invalidateQueries({ queryKey: ["parsing_review_actions", v.id] });
    },
  });
}

export function useRejectIntake() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: { id: string; reason: string; prevStatus: IntakeState }) => {
      const { data: u } = await supabase.auth.getUser();
      const { error } = await supabase
        .from(TABLE)
        .update({
          parse_status: "rejected",
          rejection_reason: args.reason,
          reviewed_by: u.user?.id ?? null,
          reviewed_at: new Date().toISOString(),
        })
        .eq("id", args.id);
      if (error) throw error;
      await logAction(args.id, "reject", { parse_status: args.prevStatus }, { parse_status: "rejected", reason: args.reason });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["intake_records"] }),
  });
}

export function useMarkDuplicate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: { id: string; workOrderId: string; prevStatus: IntakeState }) => {
      const { data: u } = await supabase.auth.getUser();
      const { error } = await supabase
        .from(TABLE)
        .update({
          parse_status: "rejected",
          rejection_reason: `Duplicate of ${args.workOrderId}`,
          converted_work_order_id: args.workOrderId,
          reviewed_by: u.user?.id ?? null,
          reviewed_at: new Date().toISOString(),
        })
        .eq("id", args.id);
      if (error) throw error;
      await logAction(args.id, "mark_duplicate", { parse_status: args.prevStatus }, { duplicate_of: args.workOrderId });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["intake_records"] }),
  });
}

export function useDismissDuplicate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: { id: string }) => {
      const { error } = await supabase
        .from(TABLE)
        .update({
          duplicate_candidates_json: [] as never,
          duplicate_confidence: 0,
          parse_status: "parsed",
        })
        .eq("id", args.id);
      if (error) throw error;
      await logAction(args.id, "dismiss_duplicate", {}, {});
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["intake_records"] }),
  });
}

function nextOrderNo() {
  const stamp = new Date().toISOString().replace(/[-:T.Z]/g, "").slice(0, 14);
  return `OCS-INT-${stamp}`;
}

export function useConvertIntake() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: { record: IntakeRecord }) => {
      const r = args.record;
      const ex = r.extracted_fields_json ?? {};
      const cat = r.suggested_categorization_json ?? {};
      const norm = (r.normalized_fields_json ?? {}) as {
        client_name?: string | null;
        client_id_suggested?: string | null;
        address?: { line_1?: string | null; city?: string | null; postcode?: string | null; postcode_zone?: string | null } | null;
        contact_phone?: string | null;
        job_type?: string | null;
        complexity_level?: "basic" | "intermediate" | "advanced" | null;
      };
      const hasNorm = !!r.normalization_version;
      const { data: u } = await supabase.auth.getUser();
      const order_no = ex.order_no?.trim() || nextOrderNo();

      // Compose admin_notes: agency/tenant trace + extracted additional_notes
      // so dispatchers and engineers see the full pre-work-order context
      // even though the schema only has a single notes column.
      const agency = ex.agency_name?.trim() || ex.client_name?.trim() || null;
      const tenantLines: string[] = [];
      if (agency) tenantLines.push(`Agency / client: ${agency}`);
      if (ex.tenant_name?.trim()) tenantLines.push(`Tenant: ${ex.tenant_name.trim()}`);
      if (ex.tenant_phone?.trim()) tenantLines.push(`Tenant phone: ${ex.tenant_phone.trim()}`);
      if (ex.tenant_email?.trim()) tenantLines.push(`Tenant email: ${ex.tenant_email.trim()}`);
      if (ex.additional_notes?.trim()) {
        tenantLines.push("");
        tenantLines.push("Additional notes (extracted):");
        tenantLines.push(ex.additional_notes.trim());
      }
      tenantLines.push("");
      tenantLines.push(
        `Converted from intake ${r.id}${hasNorm ? ` (normalized ${r.normalization_version})` : ""}`,
      );
      const adminNotes = tenantLines.join("\n");

      // Prefer the tenant as the on-site contact if known; fall back to the
      // generic contact_* fields the parser already populates.
      const contactName = ex.tenant_name?.trim() || ex.contact_name?.trim() || null;
      const contactPhone = ex.tenant_phone?.trim() || ex.contact_phone?.trim() || null;

      const { data: wo, error } = await supabase
        .from("work_orders")
        .insert({
          order_no,
          client_id:
            (hasNorm && norm.client_id_suggested) ||
            cat.client_id ||
            ex.client_id ||
            null,
          source_channel:
            r.source_type === "email"
              ? "email"
              : r.source_type === "upload"
                ? "pdf_upload"
                : r.source_type === "webhook"
                  ? "webhook"
                  : "manual_entry",
          current_status: "awaiting_client_confirmation",
          address_line_1: (hasNorm ? norm.address?.line_1 : null) ?? ex.address_line_1 ?? null,
          city: (hasNorm ? norm.address?.city : null) ?? ex.city ?? null,
          postcode: (hasNorm ? norm.address?.postcode : null) ?? ex.postcode ?? null,
          postcode_zone:
            (hasNorm ? norm.address?.postcode_zone : null) ??
            cat.postcode_zone ??
            ex.postcode_zone ??
            null,
          job_summary: ex.job_summary ?? null,
          job_description: ex.job_description ?? null,
          primary_trade: (hasNorm ? norm.job_type : null) ?? cat.primary_trade ?? null,
          complexity_level: (hasNorm ? norm.complexity_level : null) ?? cat.complexity_level ?? null,
          priority_level: cat.priority_level ?? "normal",
          engineers_required: cat.engineers_required ?? 1,
          parsing_confidence: r.parse_confidence,
          categorization_confidence: r.categorization_confidence,
          admin_notes: adminNotes,
          created_by: u.user?.id ?? null,
        })
        .select()
        .single();
      if (error) throw error;
      void contactName;
      void contactPhone;

      const { error: upErr } = await supabase
        .from(TABLE)
        .update({
          parse_status: "converted",
          converted_work_order_id: wo.id,
          reviewed_by: u.user?.id ?? null,
          reviewed_at: new Date().toISOString(),
        })
        .eq("id", r.id);
      if (upErr) throw upErr;

      await logAction(r.id, "convert", { parse_status: r.parse_status }, { work_order_id: wo.id, order_no });
      return wo;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["intake_records"] });
      qc.invalidateQueries({ queryKey: ["work_orders"] });
    },
  });
}