import { useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
  BILLING_ELIGIBLE_STATUSES,
  type BillingCase,
  type BillingStatus,
  type BillingAdjustment,
  type BillingStatusEvent,
} from "@/types/billing";
import type { WorkOrderWithRelations } from "@/types/workOrders";

type BillingCasePatch = Partial<Omit<BillingCase, "id" | "work_order_id" | "created_at" | "updated_at">>;

const WO_SELECT = `
  *,
  client:clients ( id, client_name, client_type ),
  assignments:work_order_assignments (
    id, assignment_role, assignment_status,
    engineer:engineers ( id, display_name, engineer_code )
  )
`;

export interface BillingQueueRow {
  work_order: WorkOrderWithRelations;
  billing_case: BillingCase | null;
}

export interface BillingQueueFilters {
  clientId?: string | null;
  status?: BillingStatus | "all";
  trade?: string | null;
  engineerId?: string | null;
  zone?: string | null;
  fromDate?: string | null;
  toDate?: string | null;
}

export function useBillingQueue(filters: BillingQueueFilters = {}) {
  return useQuery({
    queryKey: ["billing_queue", filters],
    queryFn: async (): Promise<BillingQueueRow[]> => {
      let q = supabase
        .from("work_orders")
        .select(WO_SELECT)
        .in(
          "current_status",
          BILLING_ELIGIBLE_STATUSES as unknown as readonly (typeof BILLING_ELIGIBLE_STATUSES)[number][],
        )
        .order("updated_at", { ascending: false })
        .limit(300);
      if (filters.clientId) q = q.eq("client_id", filters.clientId);
      if (filters.trade) q = q.eq("primary_trade", filters.trade);
      if (filters.zone) q = q.eq("postcode_zone", filters.zone);
      if (filters.fromDate) q = q.gte("updated_at", filters.fromDate);
      if (filters.toDate) q = q.lte("updated_at", filters.toDate);
      const { data: wos, error } = await q;
      if (error) throw error;
      const orders = (wos ?? []) as unknown as WorkOrderWithRelations[];
      if (orders.length === 0) return [];

      const ids = orders.map((w) => w.id);
      const { data: cases, error: cErr } = await supabase
        .from("billing_cases")
        .select("*")
        .in("work_order_id", ids);
      if (cErr) throw cErr;
      const caseMap = new Map<string, BillingCase>();
      for (const c of (cases ?? []) as BillingCase[]) caseMap.set(c.work_order_id, c);

      let rows: BillingQueueRow[] = orders.map((w) => ({
        work_order: w,
        billing_case: caseMap.get(w.id) ?? null,
      }));

      // engineer filter (assignments)
      if (filters.engineerId) {
        rows = rows.filter((r) =>
          r.work_order.assignments?.some(
            (a) => a.engineer?.id === filters.engineerId,
          ),
        );
      }

      // status filter
      if (filters.status && filters.status !== "all") {
        rows = rows.filter((r) => {
          const s = r.billing_case?.billing_status ?? "pending_review";
          return s === filters.status;
        });
      }
      return rows;
    },
  });
}

export function useBillingCase(workOrderId: string | null) {
  return useQuery({
    queryKey: ["billing_case", workOrderId],
    enabled: !!workOrderId,
    queryFn: async (): Promise<BillingCase | null> => {
      if (!workOrderId) return null;
      const { data, error } = await supabase
        .from("billing_cases")
        .select("*")
        .eq("work_order_id", workOrderId)
        .maybeSingle();
      if (error) throw error;
      return (data as BillingCase | null) ?? null;
    },
  });
}

export function useBillingAdjustments(billingCaseId: string | null) {
  return useQuery({
    queryKey: ["billing_adjustments", billingCaseId],
    enabled: !!billingCaseId,
    queryFn: async (): Promise<BillingAdjustment[]> => {
      if (!billingCaseId) return [];
      const { data, error } = await supabase
        .from("billing_adjustments")
        .select("*")
        .eq("billing_case_id", billingCaseId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as BillingAdjustment[];
    },
  });
}

export function useBillingStatusHistory(billingCaseId: string | null) {
  return useQuery({
    queryKey: ["billing_status_events", billingCaseId],
    enabled: !!billingCaseId,
    queryFn: async (): Promise<BillingStatusEvent[]> => {
      if (!billingCaseId) return [];
      const { data, error } = await supabase
        .from("billing_status_events")
        .select("*")
        .eq("billing_case_id", billingCaseId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as BillingStatusEvent[];
    },
  });
}

/** Ensure a billing case exists for the work order; create with pending_review if not. */
async function ensureBillingCase(workOrderId: string, userId: string | null) {
  const { data: existing } = await supabase
    .from("billing_cases")
    .select("*")
    .eq("work_order_id", workOrderId)
    .maybeSingle();
  if (existing) return existing as BillingCase;
  const { data, error } = await supabase
    .from("billing_cases")
    .insert({ work_order_id: workOrderId, created_by: userId ?? undefined })
    .select("*")
    .single();
  if (error) throw error;
  return data as BillingCase;
}

export function useUpdateBillingStatus() {
  const qc = useQueryClient();
  const { profile } = useAuth();
  const userId = profile?.id ?? null;
  return useMutation({
    mutationFn: async (input: {
      workOrderId: string;
      toStatus: BillingStatus;
      note?: string;
      patch?: BillingCasePatch;
    }) => {
      const existing = await ensureBillingCase(input.workOrderId, userId);
      const fromStatus = existing.billing_status;
      const patch: BillingCasePatch = {
        billing_status: input.toStatus,
        reviewed_by: userId,
        reviewed_at: new Date().toISOString(),
        ...(input.patch ?? {}),
      };
      if (input.toStatus === "invoiced" && !existing.exported_at) {
        patch.exported_at = new Date().toISOString();
      }
      const { error: uErr } = await supabase
        .from("billing_cases")
        .update(patch)
        .eq("id", existing.id);
      if (uErr) throw uErr;
      const { error: eErr } = await supabase.from("billing_status_events").insert({
        billing_case_id: existing.id,
        from_status: fromStatus,
        to_status: input.toStatus,
        note: input.note ?? null,
        actor_profile_id: userId,
      });
      if (eErr) throw eErr;
      return existing.id;
    },
    onSuccess: (_id, vars) => {
      qc.invalidateQueries({ queryKey: ["billing_queue"] });
      qc.invalidateQueries({ queryKey: ["billing_case", vars.workOrderId] });
      qc.invalidateQueries({ queryKey: ["billing_status_events"] });
    },
  });
}

export function useUpdateBillingCase() {
  const qc = useQueryClient();
  const { profile } = useAuth();
  const userId = profile?.id ?? null;
  return useMutation({
    mutationFn: async (input: {
      workOrderId: string;
      patch: BillingCasePatch;
    }) => {
      const existing = await ensureBillingCase(input.workOrderId, userId);
      const { error } = await supabase
        .from("billing_cases")
        .update(input.patch)
        .eq("id", existing.id);
      if (error) throw error;
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["billing_queue"] });
      qc.invalidateQueries({ queryKey: ["billing_case", vars.workOrderId] });
    },
  });
}

export function useAddBillingAdjustment() {
  const qc = useQueryClient();
  const { profile } = useAuth();
  const userId = profile?.id ?? null;
  return useMutation({
    mutationFn: async (input: {
      workOrderId: string;
      adjustment_type: string;
      amount?: number | null;
      note?: string | null;
    }) => {
      const existing = await ensureBillingCase(input.workOrderId, userId);
      const { error } = await supabase.from("billing_adjustments").insert({
        billing_case_id: existing.id,
        adjustment_type: input.adjustment_type,
        amount: input.amount ?? null,
        note: input.note ?? null,
        created_by: userId,
      });
      if (error) throw error;
      return existing.id;
    },
    onSuccess: (id) => {
      qc.invalidateQueries({ queryKey: ["billing_adjustments", id] });
      qc.invalidateQueries({ queryKey: ["billing_queue"] });
    },
  });
}

export interface ReadinessItem {
  key: string;
  label: string;
  ok: boolean;
}

export function useBillingReadiness(
  workOrder: WorkOrderWithRelations | null,
  billingCase: BillingCase | null,
  expenseCount: number,
  evidenceCount: number,
): { items: ReadinessItem[]; ready: boolean; reasons: string[] } {
  return useMemo(() => {
    const items: ReadinessItem[] = [];
    if (!workOrder) return { items, ready: false, reasons: ["No work order"] };
    items.push({
      key: "outcome",
      label: "Completion outcome recorded",
      ok: workOrder.current_status === "closed" ||
          workOrder.current_status === "field_submitted_complete" ||
          !!workOrder.review_outcome,
    });
    items.push({
      key: "evidence",
      label: "Evidence/files attached",
      ok: evidenceCount > 0,
    });
    items.push({
      key: "expenses_reviewed",
      label: "Expenses & receipts reviewed",
      ok: expenseCount === 0 || !!billingCase?.reviewed_at,
    });
    items.push({
      key: "advisories",
      label: "Admin/advisory notes reviewed",
      ok: !!billingCase?.reviewed_at || !workOrder.admin_notes,
    });
    items.push({
      key: "client_ref",
      label: "Client / work order reference present",
      ok: !!workOrder.client_id && !!workOrder.order_no,
    });
    const reasons = items.filter((i) => !i.ok).map((i) => i.label);
    return { items, ready: reasons.length === 0, reasons };
  }, [workOrder, billingCase, expenseCount, evidenceCount]);
}

export function useBillingExport() {
  return useMutation({
    mutationFn: async (rows: BillingQueueRow[]) => {
      const header = [
        "order_no",
        "client",
        "postcode",
        "primary_trade",
        "billing_status",
        "invoice_reference",
        "client_reference",
        "expense_total",
        "billable_total",
        "updated_at",
      ];
      const esc = (v: unknown) => {
        const s = v == null ? "" : String(v);
        return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
      };
      const lines = [header.join(",")];
      for (const r of rows) {
        lines.push(
          [
            r.work_order.order_no,
            r.work_order.client?.client_name ?? "",
            r.work_order.postcode ?? "",
            r.work_order.primary_trade ?? "",
            r.billing_case?.billing_status ?? "pending_review",
            r.billing_case?.invoice_reference ?? "",
            r.billing_case?.client_reference ?? "",
            r.billing_case?.expense_total ?? "",
            r.billing_case?.billable_total ?? "",
            r.work_order.updated_at ?? "",
          ]
            .map(esc)
            .join(","),
        );
      }
      const csv = lines.join("\n");
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `billing-export-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      return rows.length;
    },
  });
}