import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { generateText, Output } from "ai";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createLovableAiGatewayProvider } from "./ai-gateway.server";

const Item = z.object({
  name: z.string().nullable().describe("Part / line item description as printed on the receipt"),
  quantity: z.number().nullable().describe("Quantity if printed; otherwise null"),
  unit_price: z.number().nullable().describe("Per-unit price if printed; otherwise null"),
  line_total: z.number().nullable().describe("Line subtotal (qty * unit_price) if printed"),
});

const ReceiptSchema = z.object({
  vendor: z
    .string()
    .nullable()
    .describe(
      "PRIORITY 1. Merchant / supplier name as shown on the receipt header (e.g. Screwfix, Toolstation, Selco, Wickes, B&Q, Travis Perkins, Shell, BP, NCP).",
    ),
  total_amount: z
    .number()
    .nullable()
    .describe("PRIORITY 3. Grand total paid (after VAT/discounts) in the receipt currency."),
  currency: z.string().nullable().describe("ISO currency code, e.g. GBP"),
  date: z.string().nullable().describe("ISO date YYYY-MM-DD if detectable"),
  time: z.string().nullable().describe("HH:MM 24h if detectable"),
  receipt_number: z.string().nullable().describe("Receipt / invoice / reference number"),
  payment_method: z.enum(["cash", "card", "bank_transfer", "account", "other"]).nullable(),
  items: z
    .array(Item)
    .default([])
    .describe(
      "PRIORITY 2. Every purchased line item / part. Capture name + per-line cost even if quantity or unit price is missing. Skip subtotal/VAT/total rows.",
    ),
  subtotal: z.number().nullable().describe("Pre-tax subtotal if printed"),
  tax_amount: z.number().nullable().describe("VAT/tax amount if printed"),
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

    // Mark the linked expense (if any) as 'pending' immediately so the
    // UI can show "Reading receipt…" state even before AI returns.
    const { data: linkedExpense } = await supabase
      .from("work_order_expenses")
      .select("id")
      .eq("receipt_file_id", data.fileId)
      .maybeSingle();
    if (linkedExpense) {
      await supabase
        .from("work_order_expenses")
        .update({ extraction_status: "pending" })
        .eq("id", linkedExpense.id);
    }

    // Download the file bytes directly via the storage API and inline
    // them as base64. Passing a remote URL is unreliable across model
    // providers; base64 always works and avoids egress fetches from the
    // model side.
    const dl = await supabase.storage.from(file.storage_bucket).download(file.storage_path);
    if (dl.error || !dl.data) throw new Error("Could not download receipt file");
    const bytes = new Uint8Array(await dl.data.arrayBuffer());
    const mime = file.mime_type || "image/jpeg";
    const isImage = mime.startsWith("image/");
    const isPdf = mime === "application/pdf";

    const gateway = createLovableAiGatewayProvider(key);
    // gpt-5 has the strongest OCR / structured extraction on receipts.
    const model = gateway("openai/gpt-5");

    const sys = [
      "You are an OCR + extraction agent for UK trades receipts (Screwfix, Toolstation,",
      "Selco, Wickes, B&Q, Travis Perkins, City Plumbing, Plumb Center, supermarkets,",
      "fuel, parking, congestion charges, generic merchants).",
      "",
      "GOALS, IN ORDER OF PRIORITY:",
      "  1. VENDOR — the merchant / supplier name shown on the receipt header.",
      "  2. ITEMS — every purchased part / line item with at minimum a name and a cost.",
      "     Include screws, fittings, cable, fixings, fuel litres, parking session etc.",
      "     SKIP rows that are subtotal, VAT, tax, change, balance, tendered, rounding.",
      "     If quantity or unit price is not printed but a line total is, fill line_total only.",
      "     If only a unit price is printed, fill unit_price; never invent quantity.",
      "  3. TOTAL_AMOUNT — the final grand total the customer paid.",
      "  4. Everything else (date, time, receipt number, payment method, tax) — best effort.",
      "",
      "RULES:",
      " - Output null for any field you cannot reliably read. Never invent values.",
      " - Always populate raw_text with every visible character from the document.",
      " - Prefer the printed total. If multiple totals exist, use the final 'Total' / 'Amount due'.",
      " - confidence should reflect how much of vendor + items + total you reliably read.",
      "",
      "OUTPUT FORMAT:",
      " - Respond with a single JSON object that matches the provided schema.",
      " - Return JSON only. No prose, no markdown, no code fences around the JSON.",
    ].join("\n");

    const userContent: Array<Record<string, unknown>> = [
      {
        type: "text",
        text:
          "Extract structured purchase data from this receipt and return it as a JSON object " +
          "matching the schema. Capture every line item. Respond in JSON only.",
      },
    ];
    if (isImage || isPdf) {
      // AI SDK accepts Uint8Array for image/file parts with model providers
      // that support multimodal inputs.
      userContent.push({ type: "image", image: bytes, mediaType: mime });
    } else {
      userContent.push({
        type: "text",
        text: `Unsupported file type ${mime}. Treat as no image; set fields to null.`,
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
      if (linkedExpense) {
        await supabase
          .from("work_order_expenses")
          .update({
            extraction_status: "failed",
            extracted_text:
              "Extraction failed: " +
              (e instanceof Error ? e.message : "unknown error"),
          })
          .eq("id", linkedExpense.id);
      }
      return {
        vendor: null,
        total_amount: null,
        currency: null,
        date: null,
        time: null,
        receipt_number: null,
        payment_method: null,
        items: [],
        subtotal: null,
        tax_amount: null,
        confidence: 0,
        raw_text:
          "Extraction failed: " +
          (e instanceof Error ? e.message : "unknown error") +
          ". Original file is preserved.",
      };
    }

    // Persist onto the expense row that already references this file (if any).
    if (linkedExpense) {
      // Priority weighting: vendor + at least one item OR a total counts as "done".
      const hasVendor = !!result.vendor;
      const hasItems = (result.items?.length ?? 0) > 0;
      const hasTotal = result.total_amount != null;
      const score = Number(hasVendor) + Number(hasItems) + Number(hasTotal);
      const status =
        score >= 2 ? "done" : score === 1 ? "partial" : "failed";

      // Build a useful note: list parts so the engineer/dispatcher sees them
      // even before opening the editor.
      const itemNote =
        result.items
          ?.filter((it) => it.name)
          .slice(0, 8)
          .map((it) => {
            const qty = it.quantity ? `${it.quantity}× ` : "";
            const price = it.line_total ?? it.unit_price;
            return `${qty}${it.name}${price != null ? ` £${price.toFixed(2)}` : ""}`;
          })
          .join("; ") ?? "";

      const updates: Record<string, unknown> = {
        vendor: result.vendor,
        receipt_number: result.receipt_number,
        payment_method: result.payment_method,
        expense_date: result.date,
        expense_time: result.time,
        extracted_items_json: result.items as never,
        extracted_text: result.raw_text,
        extraction_status: status,
        extraction_confidence: result.confidence,
      };
      if (result.total_amount != null) updates.amount = result.total_amount;
      if (itemNote) updates.note = itemNote;

      await supabase
        .from("work_order_expenses")
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .update(updates as any)
        .eq("id", linkedExpense.id);
    }

    return result;
  });