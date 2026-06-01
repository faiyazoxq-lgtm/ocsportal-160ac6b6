import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { generateText, Output } from "ai";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createLovableAiGatewayProvider } from "./ai-gateway.server";

const Item = z.object({
  name: z.string().nullable().optional(),
  quantity: z.number().nullable().optional(),
  unit_price: z.number().nullable().optional(),
  line_total: z.number().nullable().optional(),
});

const ReceiptSchema = z.object({
  vendor: z.string().nullable().describe("Merchant or supplier name (e.g. Screwfix, Toolstation, Selco)"),
  total_amount: z.number().nullable().describe("Grand total in receipt currency"),
  currency: z.string().nullable().describe("ISO currency code, e.g. GBP"),
  date: z.string().nullable().describe("ISO date YYYY-MM-DD if detectable"),
  time: z.string().nullable().describe("HH:MM 24h if detectable"),
  receipt_number: z.string().nullable().describe("Receipt / invoice / reference number"),
  payment_method: z.enum(["cash", "card", "bank_transfer", "account", "other"]).nullable(),
  items: z.array(Item).default([]),
  confidence: z.number().min(0).max(1).describe("0-1 self-rated confidence in the structured fields"),
  raw_text: z.string().describe("All visible text from the receipt, used as fallback for human review"),
});

export type ReceiptExtractionResult = z.infer<typeof ReceiptSchema>;

const Input = z.object({
  workOrderId: z.string().uuid(),
  fileId: z.string().uuid(),
});

export const extractReceipt = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => Input.parse(d))
  .handler(async ({ data, context }): Promise<ReceiptExtractionResult> => {
    const { supabase } = context;
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("LOVABLE_API_KEY not configured");

    const { data: file, error } = await supabase
      .from("work_order_files")
      .select("storage_bucket, storage_path, mime_type, work_order_id")
      .eq("id", data.fileId)
      .maybeSingle();
    if (error) throw error;
    if (!file) throw new Error("Receipt file not found");
    if (file.work_order_id !== data.workOrderId) throw new Error("File/work order mismatch");

    const signed = await supabase.storage
      .from(file.storage_bucket)
      .createSignedUrl(file.storage_path, 600);
    if (signed.error || !signed.data) throw new Error("Could not sign receipt URL");
    const url = signed.data.signedUrl;

    const gateway = createLovableAiGatewayProvider(key);
    const model = gateway("openai/gpt-5");

    const sys =
      "You read supplier receipts (Screwfix, Toolstation, Selco, generic merchants, fuel, parking, congestion charges, etc.) for a UK trades dispatch system. " +
      "Extract structured purchase data. Output null for any field you cannot reliably read; never invent values. " +
      "Always populate raw_text with every visible character on the document so a human can review.";

    const isImage = (file.mime_type ?? "").startsWith("image/");
    const userContent: Array<Record<string, unknown>> = [
      { type: "text", text: "Extract the receipt details from the attached file." },
    ];
    if (isImage) {
      userContent.push({ type: "image", image: new URL(url) });
    } else {
      userContent.push({
        type: "text",
        text: `Document URL (non-image): ${url}. If you cannot fetch, set fields to null and explain in raw_text.`,
      });
    }

    let result: ReceiptExtractionResult;
    try {
      const { output } = await generateText({
        model,
        system: sys,
        messages: [{ role: "user", content: userContent as never }],
        output: Output.object({ schema: ReceiptSchema }),
      });
      result = output;
    } catch (e) {
      // Final fallback: don't block the user; record the failure shape.
      return {
        vendor: null,
        total_amount: null,
        currency: null,
        date: null,
        time: null,
        receipt_number: null,
        payment_method: null,
        items: [],
        confidence: 0,
        raw_text:
          "Extraction failed: " +
          (e instanceof Error ? e.message : "unknown error") +
          ". Original file is preserved.",
      };
    }

    // Persist onto the expense row that already references this file (if any).
    const { data: expense } = await supabase
      .from("work_order_expenses")
      .select("id, amount")
      .eq("receipt_file_id", data.fileId)
      .maybeSingle();
    if (expense) {
      const structuredPopulated =
        [result.vendor, result.total_amount, result.date, result.receipt_number].filter(
          (v) => v !== null && v !== undefined && v !== "",
        ).length;
      const status =
        structuredPopulated >= 3 ? "done" : structuredPopulated >= 1 ? "partial" : "failed";
      await supabase
        .from("work_order_expenses")
        .update({
          vendor: result.vendor,
          receipt_number: result.receipt_number,
          payment_method: result.payment_method,
          expense_date: result.date,
          expense_time: result.time,
          extracted_items_json: result.items as never,
          extracted_text: result.raw_text,
          extraction_status: status,
          extraction_confidence: result.confidence,
        })
        .eq("id", expense.id);
    }

    return result;
  });