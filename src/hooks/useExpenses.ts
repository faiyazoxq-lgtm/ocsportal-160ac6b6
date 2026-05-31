import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type ExpenseType = Database["public"]["Enums"]["expense_type"];

export interface WorkOrderExpense {
  id: string;
  work_order_id: string;
  expense_type: ExpenseType;
  amount: number;
  note: string | null;
  receipt_file_id: string | null;
  created_at: string;
}

export function useExpenses(workOrderId: string | null) {
  return useQuery({
    queryKey: ["work_order_expenses", workOrderId],
    enabled: !!workOrderId,
    queryFn: async (): Promise<WorkOrderExpense[]> => {
      if (!workOrderId) return [];
      const { data, error } = await supabase
        .from("work_order_expenses")
        .select("id, work_order_id, expense_type, amount, note, receipt_file_id, created_at")
        .eq("work_order_id", workOrderId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as WorkOrderExpense[];
    },
  });
}

export const EXPENSE_TYPES: { value: ExpenseType; label: string }[] = [
  { value: "parts", label: "Parts" },
  { value: "materials", label: "Materials" },
  { value: "parking", label: "Parking" },
  { value: "congestion", label: "Congestion charge" },
  { value: "fuel", label: "Fuel" },
  { value: "tools", label: "Tools" },
  { value: "other", label: "Other" },
];