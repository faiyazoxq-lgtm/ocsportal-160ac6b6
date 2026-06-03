/**
 * Shared post-AI validation + sanitization helpers for the intake/work-order
 * extractor and the engineer receipt extractor.
 *
 * Rules:
 *  - Never invent values. If a value fails validation, return null.
 *  - Always report what was stripped so the UI can show review-by-exception.
 *  - Pure functions only. No I/O, no side effects.
 */

import { normalizePostcode } from "./intakeNormalization";

// ---------- Primitive validators ----------

const EMAIL_RE = /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i;

export function validateEmail(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const s = String(raw).trim();
  if (!s) return null;
  // Strip surrounding angle brackets ("Name <foo@bar.com>" => "foo@bar.com")
  const angle = s.match(/<([^>]+)>/);
  const candidate = (angle ? angle[1] : s).trim();
  if (candidate.length > 254) return null;
  return EMAIL_RE.test(candidate) ? candidate.toLowerCase() : null;
}

/**
 * Accepts YYYY-MM-DD, ISO datetime, DD/MM/YYYY, DD-MM-YYYY. Returns
 * canonical YYYY-MM-DD or null if not a real calendar date / out of range.
 */
export function normalizeDateIso(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const s = String(raw).trim();
  if (!s) return null;

  let y: number | null = null;
  let m: number | null = null;
  let d: number | null = null;

  // ISO YYYY-MM-DD (optionally with time)
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) {
    y = +iso[1];
    m = +iso[2];
    d = +iso[3];
  } else {
    // DD/MM/YYYY or DD-MM-YYYY (UK-leaning — matches the rest of the app)
    const uk = s.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})$/);
    if (uk) {
      d = +uk[1];
      m = +uk[2];
      y = +uk[3];
      if (y < 100) y += 2000;
    }
  }

  if (y == null || m == null || d == null) return null;
  if (y < 2000 || y > 2100) return null;
  if (m < 1 || m > 12) return null;
  if (d < 1 || d > 31) return null;
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (
    dt.getUTCFullYear() !== y ||
    dt.getUTCMonth() !== m - 1 ||
    dt.getUTCDate() !== d
  ) {
    return null;
  }
  const mm = String(m).padStart(2, "0");
  const dd = String(d).padStart(2, "0");
  return `${y}-${mm}-${dd}`;
}

/** HH:MM 24h or null. */
export function normalizeTime24(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const m = String(raw).trim().match(/^(\d{1,2}):(\d{2})/);
  if (!m) return null;
  const h = +m[1];
  const mm = +m[2];
  if (h < 0 || h > 23 || mm < 0 || mm > 59) return null;
  return `${String(h).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

/**
 * Currency amount sanity check. Accepts a number; coerces a numeric string
 * if needed. Rejects non-finite, negative, or absurdly large totals.
 * Returns the value rounded to 2dp, or null.
 */
export function validateCurrencyAmount(
  raw: number | string | null | undefined,
  opts: { allowZero?: boolean; max?: number } = {},
): number | null {
  if (raw === null || raw === undefined || raw === "") return null;
  const n =
    typeof raw === "number"
      ? raw
      : Number(String(raw).replace(/[£$€,\s]/g, ""));
  if (!Number.isFinite(n)) return null;
  if (n < 0) return null;
  if (!opts.allowZero && n === 0) return null;
  const max = opts.max ?? 1_000_000;
  if (n > max) return null;
  return Math.round(n * 100) / 100;
}

/**
 * spend_limit: must be a positive number, capped at £100k (sanity).
 * Returns null for 0/negative/unrealistic values (matches "do not guess").
 */
export function validateSpendLimit(
  raw: number | string | null | undefined,
): number | null {
  return validateCurrencyAmount(raw, { allowZero: false, max: 100_000 });
}

/** Light free-text cleaner: collapse whitespace, strip empty strings. */
export function cleanText(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const s = String(raw).replace(/\s+/g, " ").trim();
  return s.length ? s : null;
}

// ---------- Strict intake extraction sanitizer ----------

export interface StrictExtractionShape {
  job_reference: string | null;
  issue_date: string | null;
  property_address: string | null;
  tenant_name: string | null;
  tenant_phone: string | null;
  tenant_email: string | null;
  job_summary: string | null;
  job_description: string | null;
  spend_limit: number | null;
  completion_deadline: string | null;
  agent_company: string | null;
  agent_email: string | null;
  keys_information: string | null;
  postcode: string | null;
  additional_notes: string | null;
  additional_contacts?: Array<{
    name: string | null;
    phone: string | null;
    email: string | null;
    role: string | null;
  }> | null;
}

export interface SanitizedStrict<T extends StrictExtractionShape> {
  value: T;
  /** Field names that were present in raw but rejected by validation. */
  stripped: string[];
}

export function sanitizeStrictExtraction<T extends StrictExtractionShape>(
  raw: T,
): SanitizedStrict<T> {
  const stripped: string[] = [];
  const out: StrictExtractionShape = { ...raw };

  out.job_reference = cleanText(raw.job_reference);
  out.property_address = cleanText(raw.property_address);
  out.tenant_name = cleanText(raw.tenant_name);
  out.tenant_phone = cleanText(raw.tenant_phone);
  out.job_summary = cleanText(raw.job_summary);
  out.job_description = cleanText(raw.job_description);
  out.agent_company = cleanText(raw.agent_company);
  out.keys_information = cleanText(raw.keys_information);
  out.additional_notes = cleanText(raw.additional_notes);

  // Sanitize additional_contacts: drop entirely-empty rows, validate emails,
  // clean text. Never invent — leave fields null if not present.
  if (Array.isArray(raw.additional_contacts)) {
    const cleaned = raw.additional_contacts
      .map((c) => {
        const email = validateEmail(c?.email ?? null);
        if ((c?.email ?? null) && !email) stripped.push("additional_contacts.email");
        return {
          name: cleanText(c?.name ?? null),
          phone: cleanText(c?.phone ?? null),
          email,
          role: cleanText(c?.role ?? null),
        };
      })
      .filter((c) => c.name || c.phone || c.email || c.role);
    out.additional_contacts = cleaned;
  } else {
    out.additional_contacts = [];
  }

  const issue = normalizeDateIso(raw.issue_date);
  if (raw.issue_date && !issue) stripped.push("issue_date");
  out.issue_date = issue;

  const deadline = normalizeDateIso(raw.completion_deadline);
  if (raw.completion_deadline && !deadline) stripped.push("completion_deadline");
  out.completion_deadline = deadline;

  const tenantEmail = validateEmail(raw.tenant_email);
  if (raw.tenant_email && !tenantEmail) stripped.push("tenant_email");
  out.tenant_email = tenantEmail;

  const agentEmail = validateEmail(raw.agent_email);
  if (raw.agent_email && !agentEmail) stripped.push("agent_email");
  out.agent_email = agentEmail;

  const spend = validateSpendLimit(raw.spend_limit);
  if (raw.spend_limit != null && spend == null) stripped.push("spend_limit");
  out.spend_limit = spend;

  // Postcode: normalize + reject if not valid UK shape (don't pass invalid
  // postcodes downstream into routing / zone derivation).
  if (raw.postcode) {
    const pc = normalizePostcode(raw.postcode);
    if (pc.valid && pc.value) {
      out.postcode = pc.value;
    } else {
      stripped.push("postcode");
      out.postcode = null;
    }
  } else {
    out.postcode = null;
  }

  return { value: out as T, stripped };
}

// ---------- Receipt sanitizer ----------

export interface ReceiptShape {
  vendor: string | null;
  total_amount: number | null;
  currency: string | null;
  date: string | null;
  time: string | null;
  receipt_number: string | null;
  payment_method: "cash" | "card" | "bank_transfer" | "account" | "other" | null;
  items: Array<{
    name: string | null;
    quantity: number | null;
    unit_price: number | null;
    line_total: number | null;
  }>;
  subtotal: number | null;
  tax_amount: number | null;
  confidence: number;
  raw_text: string;
}

export interface SanitizedReceipt<T extends ReceiptShape> {
  value: T;
  stripped: string[];
}

const CURRENCY_RE = /^[A-Z]{3}$/;

export function sanitizeReceiptExtraction<T extends ReceiptShape>(
  raw: T,
): SanitizedReceipt<T> {
  const stripped: string[] = [];
  const out: ReceiptShape = { ...raw };

  out.vendor = cleanText(raw.vendor);
  out.receipt_number = cleanText(raw.receipt_number);

  const total = validateCurrencyAmount(raw.total_amount);
  if (raw.total_amount != null && total == null) stripped.push("total_amount");
  out.total_amount = total;

  const subtotal = validateCurrencyAmount(raw.subtotal, { allowZero: true });
  if (raw.subtotal != null && subtotal == null) stripped.push("subtotal");
  out.subtotal = subtotal;

  const tax = validateCurrencyAmount(raw.tax_amount, { allowZero: true });
  if (raw.tax_amount != null && tax == null) stripped.push("tax_amount");
  out.tax_amount = tax;

  if (raw.currency) {
    const c = String(raw.currency).trim().toUpperCase();
    if (CURRENCY_RE.test(c)) out.currency = c;
    else {
      stripped.push("currency");
      out.currency = null;
    }
  } else {
    out.currency = null;
  }

  const date = normalizeDateIso(raw.date);
  if (raw.date && !date) stripped.push("date");
  // Future-dated receipt is impossible (some OCRs hallucinate years).
  // Allow up to 1 day in the future to cover timezone slop.
  if (date) {
    const ms = Date.parse(`${date}T00:00:00Z`);
    if (Number.isFinite(ms) && ms - Date.now() > 24 * 60 * 60 * 1000) {
      stripped.push("date");
      out.date = null;
    } else {
      out.date = date;
    }
  } else {
    out.date = null;
  }

  out.time = normalizeTime24(raw.time);
  if (raw.time && !out.time) stripped.push("time");

  // Items: drop rows that have neither a name nor any numeric signal, and
  // sanitize each numeric field.
  out.items = (raw.items ?? [])
    .map((it) => ({
      name: cleanText(it?.name),
      quantity:
        typeof it?.quantity === "number" &&
        Number.isFinite(it.quantity) &&
        it.quantity > 0 &&
        it.quantity < 10_000
          ? it.quantity
          : null,
      unit_price: validateCurrencyAmount(it?.unit_price, { allowZero: true }),
      line_total: validateCurrencyAmount(it?.line_total, { allowZero: true }),
    }))
    .filter(
      (it) =>
        it.name ||
        it.quantity != null ||
        it.unit_price != null ||
        it.line_total != null,
    );

  // Clamp confidence into [0,1]
  const conf = Number(raw.confidence);
  out.confidence = Number.isFinite(conf) ? Math.max(0, Math.min(1, conf)) : 0;

  // raw_text is preserved as-is for human review.
  out.raw_text = typeof raw.raw_text === "string" ? raw.raw_text : "";

  return { value: out as T, stripped };
}

/**
 * Compute receipt status tier based on what survived validation.
 */
export function computeReceiptStatus(
  r: ReceiptShape,
): "done" | "partial" | "failed" {
  const hasVendor = !!r.vendor;
  const hasItems = (r.items?.length ?? 0) > 0;
  const hasTotal = r.total_amount != null;
  const score = Number(hasVendor) + Number(hasItems) + Number(hasTotal);
  if (score >= 2) return "done";
  if (score === 1) return "partial";
  return "failed";
}

/**
 * Merge AI-extracted receipt fields into an existing expense row, never
 * overwriting values an engineer has already typed manually.
 *
 * Returns the partial update object to send to Supabase.
 */
export function buildExpenseMergePatch(args: {
  existing: Record<string, unknown>;
  extracted: ReceiptShape;
  status: "done" | "partial" | "failed";
}): Record<string, unknown> {
  const { existing, extracted, status } = args;
  const patch: Record<string, unknown> = {
    extraction_status: status,
    extraction_confidence: extracted.confidence,
    extracted_text: extracted.raw_text,
    extracted_items_json: extracted.items as never,
  };

  const fillIfEmpty = (col: string, next: unknown) => {
    if (next === null || next === undefined || next === "") return;
    const cur = existing[col];
    if (cur === null || cur === undefined || cur === "") {
      patch[col] = next;
    }
  };

  fillIfEmpty("vendor", extracted.vendor);
  fillIfEmpty("receipt_number", extracted.receipt_number);
  fillIfEmpty("payment_method", extracted.payment_method);
  fillIfEmpty("expense_date", extracted.date);
  fillIfEmpty("expense_time", extracted.time);
  if (extracted.total_amount != null) {
    fillIfEmpty("amount", extracted.total_amount);
  }

  // Build a useful itemized note IF the engineer hasn't already written one.
  const itemNote = extracted.items
    .filter((it) => it.name)
    .slice(0, 8)
    .map((it) => {
      const qty = it.quantity ? `${it.quantity}× ` : "";
      const price = it.line_total ?? it.unit_price;
      return `${qty}${it.name}${price != null ? ` £${price.toFixed(2)}` : ""}`;
    })
    .join("; ");
  if (itemNote) fillIfEmpty("note", itemNote);

  return patch;
}