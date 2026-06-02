import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import type { ExpenseType } from "@/hooks/useExpenses";
import type {
  ExtractedItem,
  ExtractionStatus,
  PaymentMethod,
  PaymentStatus,
} from "@/types/expenses";
import { extractReceipt } from "@/lib/receiptExtraction.functions";

export interface FullWorkOrderExpense {
  id: string;
  work_order_id: string;
  expense_type: ExpenseType;
  amount: number;
  note: string | null;
  receipt_file_id: string | null;
  vendor: string | null;
  expense_date: string | null;
  expense_time: string | null;
  receipt_number: string | null;
  payment_method: PaymentMethod | null;
  payment_status: PaymentStatus;
  paid_at: string | null;
  paid_by: string | null;
  payment_reference: string | null;
  paid_note: string | null;
  extracted_items_json: ExtractedItem[];
  extracted_text: string | null;
  extraction_status: ExtractionStatus;
  extraction_confidence: number | null;
  created_at: string;
  updated_at: string;
  entered_by_engineer_id: string | null;
  entered_by_profile_id: string | null;
}

const FULL_SELECT =
  "id, work_order_id, expense_type, amount, note, receipt_file_id, vendor, expense_date, expense_time, receipt_number, payment_method, payment_status, paid_at, paid_by, payment_reference, paid_note, extracted_items_json, extracted_text, extraction_status, extraction_confidence, created_at, updated_at, entered_by_engineer_id, entered_by_profile_id";

export function useWorkOrderExpenses(workOrderId: string | null) {
  return useQuery({
    queryKey: ["work_order_expenses", workOrderId],
    enabled: !!workOrderId,
    queryFn: async (): Promise<FullWorkOrderExpense[]> => {
      if (!workOrderId) return [];
      const { data, error } = await supabase
        .from("work_order_expenses")
        .select(FULL_SELECT)
        .eq("work_order_id", workOrderId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as FullWorkOrderExpense[];
    },
  });
}

export interface UpsertExpenseInput {
  id?: string;
  work_order_id: string;
  expense_type: ExpenseType;
  amount: number;
  vendor?: string | null;
  expense_date?: string | null;
  expense_time?: string | null;
  receipt_number?: string | null;
  payment_method?: PaymentMethod | null;
  payment_status?: PaymentStatus;
  note?: string | null;
  receipt_file_id?: string | null;
  paid_at?: string | null;
}

export function useUpsertWorkOrderExpense() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: UpsertExpenseInput) => {
      const { data: u } = await supabase.auth.getUser();
      const userId = u.user?.id ?? null;
      const payload = {
        ...input,
        updated_by_profile_id: userId,
      };
      if (input.id) {
        const { id, work_order_id: _w, ...rest } = payload;
        void _w;
        const { error } = await supabase
          .from("work_order_expenses")
          .update(rest)
          .eq("id", id!);
        if (error) throw error;
        return id!;
      }
      const { data, error } = await supabase
        .from("work_order_expenses")
        .insert({ ...payload, entered_by_profile_id: userId })
        .select("id")
        .single();
      if (error) throw error;
      return data.id;
    },
    onSuccess: (_id, vars) => {
      qc.invalidateQueries({ queryKey: ["work_order_expenses", vars.work_order_id] });
      qc.invalidateQueries({ queryKey: ["dispatcher_expenses"] });
    },
  });
}

export function useDeleteWorkOrderExpense(workOrderId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("work_order_expenses").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["work_order_expenses", workOrderId] });
      qc.invalidateQueries({ queryKey: ["dispatcher_expenses"] });
    },
  });
}

export function useReceiptExtraction() {
  const run = useServerFn(extractReceipt);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (vars: { workOrderId: string; fileId: string }) => {
      const res = await run({ data: vars });
      return res;
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["work_order_expenses", vars.workOrderId] });
    },
  });
}

export function usePushWorkOrderExpenses(workOrderId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      const { error } = await supabase
        .from("work_orders")
        .update({
          expenses_pushed_at: new Date().toISOString(),
          expenses_pushed_by: u.user?.id ?? null,
        })
        .eq("id", workOrderId);
      if (error) throw error;
      await supabase.from("work_order_events").insert({
        work_order_id: workOrderId,
        event_type: "expenses_pushed",
        event_label: "Dispatcher pushed expenses to ledger",
        event_payload_json: {} as never,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["work_orders"] });
      qc.invalidateQueries({ queryKey: ["work_orders", "detail", workOrderId] });
      qc.invalidateQueries({ queryKey: ["dispatcher_expenses"] });
    },
  });
}

export interface MarkPaidInput {
  id: string;
  work_order_id: string;
  payment_method?: PaymentMethod | null;
  payment_reference?: string | null;
  paid_note?: string | null;
  paid_at?: string;
}

/**
 * Mark a single expense as paid, capturing who/when/method/reference/note.
 * Dispatcher + Boss can run this (RLS already covers both).
 */
export function useMarkExpensePaid() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: MarkPaidInput) => {
      const { data: u } = await supabase.auth.getUser();
      const userId = u.user?.id ?? null;
      const { error } = await supabase
        .from("work_order_expenses")
        .update({
          payment_status: "paid",
          paid_at: input.paid_at ?? new Date().toISOString(),
          paid_by: userId,
          payment_method: input.payment_method ?? undefined,
          payment_reference: input.payment_reference ?? null,
          paid_note: input.paid_note ?? null,
          updated_by_profile_id: userId,
        })
        .eq("id", input.id);
      if (error) throw error;
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["work_order_expenses", vars.work_order_id] });
      qc.invalidateQueries({ queryKey: ["dispatcher_expenses"] });
      qc.invalidateQueries({ queryKey: ["expense_payment_history"] });
    },
  });
}

/**
 * Revert a paid expense back to pending. Clears paid metadata.
 */
export function useRevertExpensePending() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; work_order_id: string }) => {
      const { data: u } = await supabase.auth.getUser();
      const { error } = await supabase
        .from("work_order_expenses")
        .update({
          payment_status: "pending",
          paid_at: null,
          paid_by: null,
          payment_reference: null,
          paid_note: null,
          updated_by_profile_id: u.user?.id ?? null,
        })
        .eq("id", input.id);
      if (error) throw error;
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["work_order_expenses", vars.work_order_id] });
      qc.invalidateQueries({ queryKey: ["dispatcher_expenses"] });
      qc.invalidateQueries({ queryKey: ["expense_payment_history"] });
    },
  });
}

export interface PaymentHistoryRow extends FullWorkOrderExpense {
  work_order: { id: string; order_no: string } | null;
  paid_by_profile: { id: string; full_name: string | null; email: string } | null;
}

export function useExpensePaymentHistory(limit = 100) {
  return useQuery({
    queryKey: ["expense_payment_history", limit],
    queryFn: async (): Promise<PaymentHistoryRow[]> => {
      const { data, error } = await supabase
        .from("work_order_expenses")
        .select(
          FULL_SELECT +
            ", work_order:work_orders(id, order_no)" +
            ", paid_by_profile:profiles!work_order_expenses_paid_by_fkey(id, full_name, email)",
        )
        .eq("payment_status", "paid")
        .not("paid_at", "is", null)
        .order("paid_at", { ascending: false })
        .limit(limit);
      if (error) {
        // Fallback if FK alias not available — fetch without joined profile
        const { data: d2, error: e2 } = await supabase
          .from("work_order_expenses")
          .select(FULL_SELECT + ", work_order:work_orders(id, order_no)")
          .eq("payment_status", "paid")
          .not("paid_at", "is", null)
          .order("paid_at", { ascending: false })
          .limit(limit);
        if (e2) throw e2;
        return (d2 ?? []).map((r: unknown) => ({
          ...(r as PaymentHistoryRow),
          paid_by_profile: null,
        })) as PaymentHistoryRow[];
      }
      return (data ?? []) as unknown as PaymentHistoryRow[];
    },
  });
}

export interface DispatcherExpenseRow extends FullWorkOrderExpense {
  work_order: {
    id: string;
    order_no: string;
    current_status: string;
    expenses_pushed_at: string | null;
    client: { id: string; client_name: string } | null;
  } | null;
}

export function useDispatcherExpenses() {
  return useQuery({
    queryKey: ["dispatcher_expenses"],
    queryFn: async (): Promise<DispatcherExpenseRow[]> => {
      const { data, error } = await supabase
        .from("work_order_expenses")
        .select(
          FULL_SELECT +
            ", work_order:work_orders(id, order_no, current_status, expenses_pushed_at, client:clients(id, client_name))",
        )
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return (data ?? []) as unknown as DispatcherExpenseRow[];
    },
  });
}

export function useVendorExpenseTotals(rows: DispatcherExpenseRow[] | undefined) {
  const map: Record<string, { vendor: string; pending: number; paid: number; count: number }> = {};
  for (const r of rows ?? []) {
    const key = (r.vendor ?? "(unspecified)").trim() || "(unspecified)";
    if (!map[key]) map[key] = { vendor: key, pending: 0, paid: 0, count: 0 };
    map[key].count += 1;
    if (r.payment_status === "paid") map[key].paid += Number(r.amount);
    else if (r.payment_status === "pending") map[key].pending += Number(r.amount);
  }
  return Object.values(map).sort((a, b) => b.pending - a.pending);
}