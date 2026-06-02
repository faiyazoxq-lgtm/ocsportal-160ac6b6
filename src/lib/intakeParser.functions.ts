import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export const PARSER_VERSION = "ocs-intake-parser/2026.05.31";

const InputSchema = z.object({
  intakeId: z.string().uuid(),
  force: z.boolean().optional(),
});

type ParseMethod =
  | "email_text"
  | "webhook_json"
  | "pdf_ocr"
  | "image_ocr"
  | "manual_text"
  | "empty";

interface ExtractedFields {
  order_no?: string | null;
  client_name?: string | null;
  address_line_1?: string | null;
  city?: string | null;
  postcode?: string | null;
  postcode_zone?: string | null;
  job_summary?: string | null;
  job_description?: string | null;
  contact_name?: string | null;
  contact_phone?: string | null;
  agency_name?: string | null;
  tenant_name?: string | null;
  tenant_phone?: string | null;
  tenant_email?: string | null;
  additional_notes?: string | null;
}

interface SuggestedCategorization {
  primary_trade?: string | null;
  complexity_level?: "basic" | "intermediate" | "advanced" | null;
  priority_level?: "low" | "normal" | "high" | "urgent" | null;
  postcode_zone?: string | null;
  engineers_required?: number | null;
}

interface ParseOutput {
  extracted_fields: ExtractedFields;
  suggested_categorization: SuggestedCategorization;
  extracted_sections: Record<string, unknown>;
  extracted_text: string;
  confidence_by_field: Record<string, number>;
  parse_confidence: number;
  categorization_confidence: number;
  missing_fields: string[];
  parsing_issues: string[];
}

const EXTRACTION_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [
    "extracted_fields",
    "suggested_categorization",
    "extracted_sections",
    "extracted_text",
    "confidence_by_field",
    "parse_confidence",
    "categorization_confidence",
    "missing_fields",
    "parsing_issues",
  ],
  properties: {
    extracted_fields: {
      type: "object",
      additionalProperties: false,
      properties: {
        order_no: { type: ["string", "null"] },
        client_name: { type: ["string", "null"] },
        address_line_1: { type: ["string", "null"] },
        city: { type: ["string", "null"] },
        postcode: { type: ["string", "null"] },
        postcode_zone: { type: ["string", "null"] },
        job_summary: { type: ["string", "null"] },
        job_description: { type: ["string", "null"] },
        contact_name: { type: ["string", "null"] },
        contact_phone: { type: ["string", "null"] },
        agency_name: { type: ["string", "null"] },
        tenant_name: { type: ["string", "null"] },
        tenant_phone: { type: ["string", "null"] },
        tenant_email: { type: ["string", "null"] },
        additional_notes: { type: ["string", "null"] },
      },
    },
    suggested_categorization: {
      type: "object",
      additionalProperties: false,
      properties: {
        priority_level: { type: ["string", "null"], enum: ["low", "normal", "high", "urgent", null] },
        postcode_zone: { type: ["string", "null"] },
        engineers_required: { type: ["integer", "null"] },
      },
    },
    extracted_sections: {
      type: "object",
      additionalProperties: true,
      description: "Free-form named sections captured from the source (e.g. header, body, dates).",
    },
    extracted_text: { type: "string" },
    confidence_by_field: {
      type: "object",
      additionalProperties: { type: "number" },
      description: "Per-field confidence 0..1.",
    },
    parse_confidence: { type: "number" },
    categorization_confidence: { type: "number" },
    missing_fields: { type: "array", items: { type: "string" } },
    parsing_issues: { type: "array", items: { type: "string" } },
  },
} as const;

const SYSTEM_PROMPT = `You are the parser for OCS, a UK work-order operations platform.
Extract structured fields from inbound work-order sources (emails, PDFs, scanned images, webhook payloads).
Rules:
- Return strict JSON matching the provided schema. Use null for unknowns. Do not invent values.
- UK addresses: split building+street into address_line_1, town into city, full postcode into postcode, and the outward code (e.g. NW1, SE5, E8) into postcode_zone.
- primary_trade ∈ heating, plumbing, electrical, gas, drainage, damp-mould, multi-trade, carpentry, painting, roofing, locksmith, appliance, other.
- priority_level: 'urgent' for gas leaks/flooding/no heat in winter/safety, 'high' for no hot water / no power, 'normal' otherwise.
- complexity_level: 'basic' for simple swap/inspection, 'intermediate' for typical repair, 'advanced' for certifications or multi-engineer.
- confidence_by_field: 0..1 per extracted field key. parse_confidence reflects overall extraction quality.
- missing_fields: list any of [order_no, client_name, address_line_1, postcode, job_summary, contact_phone] that you could not extract.
- parsing_issues: short human notes about ambiguity, low legibility, or contradictions.
- extracted_text: a clean normalized plain-text rendering of the source (especially important for scanned PDFs / images so an admin can audit OCR).

Agency vs tenant — read this carefully, it matters operationally:
- agency_name: the managing agent, council, housing association, landlord, property manager, or business CLIENT that is INSTRUCTING the work. Usually the sender's organisation (look at sender email domain, letterhead, signature block, "from", "instructed by", "on behalf of"). This is the same as client_name in most cases — populate both.
- tenant_name: the occupier / resident / end-user at the SITE who is experiencing the issue. Often appears as "tenant:", "resident:", "occupier:", "reported by", "contact at property", or named in the body ("Mrs Smith reports…"). Never use the sending agent's staff name as the tenant.
- tenant_phone: the tenant's direct contact number for access/arrival. Prefer mobile numbers tied to the tenant name. Do NOT use the agency's switchboard or the sender's office number as tenant_phone.
- tenant_email: the tenant's email if explicitly shown. Do NOT use the agency staff email.
- If multiple possible tenant contacts appear, pick the one most clearly tied to the property/occupier and note the ambiguity in additional_notes (e.g. "Two contacts listed: Mrs Smith 0207… and partner Mr Jones 0208…").
- If tenant phone or email is not confidently present, leave it null. Do not guess. Do not fabricate.
- contact_name / contact_phone: keep as the best overall site contact (tenant if known, otherwise agency contact). It is fine for contact_* to equal tenant_* when the tenant is the primary contact.

additional_notes: capture useful extracted detail that does NOT fit the structured fields — access instructions, key safe codes, vulnerability flags, parking notes, reference numbers (landlord ref, job ref, PO numbers other than order_no), preferred appointment windows, secondary contacts, agency case handler name, anything quoted from the email/attachments that a dispatcher would want to see before raising the work order. Keep it concise plain text, bullet-style lines are fine. Use null if there is nothing extra worth preserving.

Use email body AND attachment OCR text together when both are provided — they often complement each other (e.g. body names the agency, attached job sheet names the tenant).`;

async function callGateway(messages: Array<Record<string, unknown>>): Promise<ParseOutput> {
  const apiKey = process.env.LOVABLE_API_KEY;
  if (!apiKey) throw new Error("LOVABLE_API_KEY is not configured");

  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages,
      response_format: {
        type: "json_schema",
        json_schema: { name: "intake_extraction", strict: true, schema: EXTRACTION_SCHEMA },
      },
    }),
  });

  if (res.status === 429) throw new Error("AI rate limit reached — try again shortly");
  if (res.status === 402) throw new Error("AI credits exhausted — top up Lovable AI workspace");
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`AI gateway error ${res.status}: ${text.slice(0, 200)}`);
  }
  const json = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = json.choices?.[0]?.message?.content;
  if (!content) throw new Error("AI gateway returned no content");
  try {
    return JSON.parse(content) as ParseOutput;
  } catch {
    throw new Error("AI gateway returned non-JSON output");
  }
}

function pickMethod(args: {
  hasFile: boolean;
  mime: string | null;
  sourceType: string;
  rawText: string | null;
  rawPayload: unknown;
}): ParseMethod {
  const { hasFile, mime, sourceType, rawText, rawPayload } = args;
  if (hasFile && mime?.startsWith("image/")) return "image_ocr";
  if (hasFile && mime === "application/pdf") return "pdf_ocr";
  if (sourceType === "webhook" || (rawPayload && Object.keys((rawPayload as object) ?? {}).length > 0)) {
    return "webhook_json";
  }
  if (sourceType === "email" && (rawText ?? "").length > 0) return "email_text";
  if ((rawText ?? "").length > 0) return "manual_text";
  return "empty";
}

async function buildMessages(args: {
  method: ParseMethod;
  rawText: string | null;
  rawPayload: unknown;
  fileUrl: string | null;
  mime: string | null;
}): Promise<Array<Record<string, unknown>>> {
  const { method, rawText, rawPayload, fileUrl, mime } = args;
  const userContent: Array<Record<string, unknown>> = [];

  let textBlock = "";
  if (method === "webhook_json") {
    textBlock = `Inbound webhook payload (JSON):\n\n${JSON.stringify(rawPayload ?? {}, null, 2).slice(0, 16000)}`;
    if (rawText) textBlock += `\n\nAttached raw text:\n${rawText.slice(0, 8000)}`;
  } else if (method === "email_text" || method === "manual_text") {
    textBlock = `Inbound ${method === "email_text" ? "email" : "manual entry"} body:\n\n${(rawText ?? "").slice(0, 16000)}`;
  } else if (method === "pdf_ocr" || method === "image_ocr") {
    textBlock = `Inbound ${method === "pdf_ocr" ? "PDF document" : "image"} — perform OCR if needed, then extract structured fields.`;
    if (rawText) textBlock += `\n\nAdditional context text:\n${rawText.slice(0, 8000)}`;
  } else {
    textBlock = "No usable content. Return empty fields with parse_confidence 0.";
  }

  userContent.push({ type: "text", text: textBlock });

  if ((method === "pdf_ocr" || method === "image_ocr") && fileUrl) {
    if (mime?.startsWith("image/")) {
      userContent.push({ type: "image_url", image_url: { url: fileUrl } });
    } else {
      // PDF — pass as image_url; Gemini handles PDF inputs via URL.
      userContent.push({ type: "image_url", image_url: { url: fileUrl } });
    }
  }

  return [
    { role: "system", content: SYSTEM_PROMPT },
    { role: "user", content: userContent },
  ];
}

function deriveZone(postcode?: string | null): string | null {
  if (!postcode) return null;
  const m = postcode.toUpperCase().match(/^[A-Z]{1,2}\d{1,2}[A-Z]?/);
  return m ? m[0] : null;
}

export const parseIntakeRecord = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => InputSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // Dispatcher gate
    const { data: roleRow, error: roleErr } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "dispatcher")
      .maybeSingle();
    if (roleErr) throw new Error(roleErr.message);
    if (!roleRow) throw new Error("Only dispatchers can run intake parsing");

    const { data: record, error: recErr } = await supabase
      .from("intake_records")
      .select("*")
      .eq("id", data.intakeId)
      .maybeSingle();
    if (recErr) throw new Error(recErr.message);
    if (!record) throw new Error("Intake record not found");

    // Mark parsing started
    await supabase
      .from("intake_records")
      .update({
        capture_status: "parsing",
        parsing_started_at: new Date().toISOString(),
        parse_error: null,
      })
      .eq("id", record.id);

    try {
      const method = pickMethod({
        hasFile: !!record.source_file_path,
        mime: record.original_mime_type ?? null,
        sourceType: record.source_type,
        rawText: record.raw_text,
        rawPayload: record.raw_payload_json,
      });

      let fileUrl: string | null = null;
      if (record.source_file_path && record.source_bucket) {
        const { data: signed, error: sErr } = await supabase.storage
          .from(record.source_bucket)
          .createSignedUrl(record.source_file_path, 60 * 10);
        if (sErr) throw new Error(`Signed URL failed: ${sErr.message}`);
        fileUrl = signed?.signedUrl ?? null;
      }

      let result: ParseOutput;
      if (method === "empty") {
        result = {
          extracted_fields: {},
          suggested_categorization: {},
          extracted_sections: {},
          extracted_text: "",
          confidence_by_field: {},
          parse_confidence: 0,
          categorization_confidence: 0,
          missing_fields: ["order_no", "client_name", "address_line_1", "postcode", "job_summary"],
          parsing_issues: ["No source content available to parse."],
        };
      } else {
        const messages = await buildMessages({
          method,
          rawText: record.raw_text,
          rawPayload: record.raw_payload_json,
          fileUrl,
          mime: record.original_mime_type ?? null,
        });
        result = await callGateway(messages);
      }

      // Backfill postcode_zone if model omitted it
      const ef = result.extracted_fields ?? {};
      if (!ef.postcode_zone) ef.postcode_zone = deriveZone(ef.postcode);
      const cat = result.suggested_categorization ?? {};
      if (!cat.postcode_zone) cat.postcode_zone = ef.postcode_zone ?? null;

      // Decide next parse_status: needs_review if confidence < 0.85 or missing critical fields
      const lowConfidence = (result.parse_confidence ?? 0) < 0.85;
      const missingCritical = (result.missing_fields ?? []).some((f) =>
        ["address_line_1", "postcode", "job_summary"].includes(f),
      );
      const nextStatus = lowConfidence || missingCritical ? "needs_review" : "parsed";

      const ocrUsed = method === "pdf_ocr" || method === "image_ocr";

      const { error: updErr } = await supabase
        .from("intake_records")
        .update({
          extracted_fields_json: ef as never,
          suggested_categorization_json: cat as never,
          extracted_sections_json: (result.extracted_sections ?? {}) as never,
          extracted_text: result.extracted_text ?? null,
          extraction_confidence_by_field: (result.confidence_by_field ?? {}) as never,
          parse_confidence: result.parse_confidence ?? null,
          categorization_confidence: result.categorization_confidence ?? null,
          missing_fields_json: (result.missing_fields ?? []) as never,
          parsing_issues_json: (result.parsing_issues ?? []) as never,
          parse_status: nextStatus,
          capture_status: "parsed",
          parser_version: PARSER_VERSION,
          parse_method: method,
          ocr_used: ocrUsed,
          parsing_completed_at: new Date().toISOString(),
          parse_error: null,
        })
        .eq("id", record.id);
      if (updErr) throw new Error(updErr.message);

      // Audit
      await supabase.from("parsing_review_actions").insert({
        intake_record_id: record.id,
        reviewer_profile_id: userId,
        action_type: "parser_run",
        previous_values_json: {
          parser_version: record.parser_version,
          parse_method: record.parse_method,
          parse_status: record.parse_status,
        } as never,
        next_values_json: {
          parser_version: PARSER_VERSION,
          parse_method: method,
          parse_status: nextStatus,
          ocr_used: ocrUsed,
        } as never,
        note: data.force ? "Reprocessed by dispatcher" : "Parsed by dispatcher",
      });

      return {
        ok: true,
        method,
        parse_confidence: result.parse_confidence,
        next_status: nextStatus,
      };
    } catch (e) {
      const msg = (e as Error).message ?? "Unknown parse error";
      await supabase
        .from("intake_records")
        .update({
          capture_status: "failed",
          parse_error: msg,
          parser_version: PARSER_VERSION,
          parsing_completed_at: new Date().toISOString(),
        })
        .eq("id", record.id);
      throw e;
    }
  });