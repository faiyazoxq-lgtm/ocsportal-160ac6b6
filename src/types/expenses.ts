export type PaymentStatus = "pending" | "paid" | "not_billable";
export type PaymentMethod = "cash" | "card" | "bank_transfer" | "account" | "other";
export type ExtractionStatus = "none" | "pending" | "partial" | "done" | "failed";

export interface ExtractedItem {
  name: string | null;
  quantity: number | null;
  unit_price: number | null;
  line_total: number | null;
}

export const PAYMENT_METHOD_OPTIONS: { value: PaymentMethod; label: string }[] = [
  { value: "cash", label: "Cash" },
  { value: "card", label: "Card" },
  { value: "bank_transfer", label: "Bank transfer" },
  { value: "account", label: "Trade account" },
  { value: "other", label: "Other" },
];

export const PAYMENT_STATUS_OPTIONS: { value: PaymentStatus; label: string }[] = [
  { value: "pending", label: "Pending payment" },
  { value: "paid", label: "Paid" },
  { value: "not_billable", label: "Not billable" },
];