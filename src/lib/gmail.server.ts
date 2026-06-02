/**
 * Server-only helpers for talking to Gmail via the Lovable connector gateway.
 * Uses the managed Google Mail connector — no per-project Google OAuth client
 * required. The workspace owner's Google account (whoever set up the
 * connector) IS the company mailbox.
 *
 * NEVER import this file from client code. The `.server.ts` suffix is
 * enforced by the bundler.
 */

const GATEWAY_URL = "https://connector-gateway.lovable.dev/google_mail/gmail/v1";

export const GMAIL_OAUTH_SCOPES = [
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/gmail.send",
  "https://www.googleapis.com/auth/gmail.modify",
  "https://www.googleapis.com/auth/gmail.labels",
];

/**
 * Back-compat shim — the OAuth flow is no longer used. Kept so existing
 * call sites that import this don't break; throws if invoked.
 */
export function googleOAuthCreds(): { clientId: string; clientSecret: string } {
  throw new Error(
    "Direct Google OAuth is disabled. The company mailbox uses the Lovable Google Mail connector.",
  );
}

function gatewayCreds(): { lovableKey: string; connectorKey: string } {
  const lovableKey = process.env.LOVABLE_API_KEY;
  const connectorKey = process.env.GOOGLE_MAIL_API_KEY;
  if (!lovableKey) {
    throw new Error(
      "LOVABLE_API_KEY is missing. The Lovable connector gateway can't be reached.",
    );
  }
  if (!connectorKey) {
    throw new Error(
      "GOOGLE_MAIL_API_KEY is missing. Link the Gmail connector in Lovable Connectors.",
    );
  }
  return { lovableKey, connectorKey };
}

/** True when the Lovable Gmail connector is linked to this project. */
export async function isGmailLinked(): Promise<boolean> {
  return Boolean(process.env.LOVABLE_API_KEY && process.env.GOOGLE_MAIL_API_KEY);
}

async function gmailFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const { lovableKey, connectorKey } = gatewayCreds();
  return fetch(`${GATEWAY_URL}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${lovableKey}`,
      "X-Connection-Api-Key": connectorKey,
      ...(init.headers ?? {}),
    },
  });
}

async function gmailJson<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await gmailFetch(path, init);
  const body = await res.text();
  if (!res.ok) {
    throw new Error(`Gmail API ${res.status}: ${body.slice(0, 500)}`);
  }
  return body ? (JSON.parse(body) as T) : ({} as T);
}

/* ---------- Profile / identity ---------- */

export interface GmailProfile {
  emailAddress: string;
  historyId?: string;
  messagesTotal?: number;
  threadsTotal?: number;
}

export async function getGmailProfile(): Promise<GmailProfile> {
  return gmailJson<GmailProfile>("/users/me/profile");
}

/* ---------- Messages ---------- */

export interface GmailHeader { name: string; value: string }
export interface GmailPayloadPart {
  partId?: string;
  mimeType?: string;
  filename?: string;
  headers?: GmailHeader[];
  body?: { size?: number; data?: string; attachmentId?: string };
  parts?: GmailPayloadPart[];
}
export interface GmailMessage {
  id: string;
  threadId: string;
  historyId?: string;
  internalDate?: string;
  labelIds?: string[];
  snippet?: string;
  payload?: GmailPayloadPart;
}

export async function listMessageIds(opts: { q?: string; maxResults?: number; pageToken?: string } = {}): Promise<{
  messages?: { id: string; threadId: string }[];
  nextPageToken?: string;
  resultSizeEstimate?: number;
}> {
  const params = new URLSearchParams();
  params.set("maxResults", String(opts.maxResults ?? 25));
  params.set("q", opts.q ?? "in:inbox newer_than:30d");
  if (opts.pageToken) params.set("pageToken", opts.pageToken);
  return gmailJson(`/users/me/messages?${params.toString()}`);
}

export async function getMessageFull(id: string): Promise<GmailMessage> {
  return gmailJson<GmailMessage>(`/users/me/messages/${id}?format=full`);
}

export async function modifyLabels(id: string, addLabelIds: string[] = [], removeLabelIds: string[] = []): Promise<void> {
  await gmailJson(`/users/me/messages/${id}/modify`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ addLabelIds, removeLabelIds }),
  });
}

/** Move a Gmail message to Trash (recoverable; permanent delete is not supported by the connector scope). */
export async function trashGmailMessage(id: string): Promise<void> {
  await gmailJson(`/users/me/messages/${id}/trash`, { method: "POST" });
}

/* ---------- History (delta sync) ----------
 * Gmail's `users.history.list` returns the stream of changes since a
 * given `startHistoryId` — message additions, deletions, label changes.
 * If the saved historyId is too old, Gmail responds 404 and the caller
 * must fall back to a full inbox reconciliation. */

export interface GmailHistoryRecord {
  id: string;
  messages?: { id: string; threadId: string }[];
  messagesAdded?: { message: { id: string; threadId: string; labelIds?: string[] } }[];
  messagesDeleted?: { message: { id: string; threadId: string } }[];
  labelsAdded?: { message: { id: string; threadId: string }; labelIds: string[] }[];
  labelsRemoved?: { message: { id: string; threadId: string }; labelIds: string[] }[];
}

export interface GmailHistoryResponse {
  history?: GmailHistoryRecord[];
  nextPageToken?: string;
  historyId?: string;
}

/**
 * Returns null when Gmail rejects the startHistoryId as too old (HTTP 404).
 * The caller should perform a full reconciliation in that case.
 */
export async function listGmailHistory(opts: {
  startHistoryId: string;
  historyTypes?: Array<"messageAdded" | "messageDeleted" | "labelAdded" | "labelRemoved">;
  labelId?: string;
  maxResults?: number;
  pageToken?: string;
}): Promise<GmailHistoryResponse | null> {
  const params = new URLSearchParams();
  params.set("startHistoryId", opts.startHistoryId);
  params.set("maxResults", String(opts.maxResults ?? 500));
  for (const t of opts.historyTypes ?? [
    "messageAdded",
    "messageDeleted",
    "labelAdded",
    "labelRemoved",
  ]) {
    params.append("historyTypes", t);
  }
  if (opts.labelId) params.set("labelId", opts.labelId);
  if (opts.pageToken) params.set("pageToken", opts.pageToken);
  const res = await gmailFetch(`/users/me/history?${params.toString()}`);
  if (res.status === 404 || res.status === 410) return null;
  const body = await res.text();
  if (!res.ok) throw new Error(`Gmail history ${res.status}: ${body.slice(0, 500)}`);
  return body ? (JSON.parse(body) as GmailHistoryResponse) : {};
}

/* ---------- Labels ---------- */

export interface GmailLabel {
  id: string;
  name: string;
  type?: "system" | "user";
}

export async function listLabels(): Promise<GmailLabel[]> {
  const res = await gmailJson<{ labels?: GmailLabel[] }>("/users/me/labels");
  return res.labels ?? [];
}

/**
 * Resolve a Gmail label by name, creating it if it doesn't exist.
 * Falls back to `null` if the label can't be created (e.g. missing scope).
 */
export async function ensureLabel(name: string): Promise<string | null> {
  try {
    const labels = await listLabels();
    const trimmed = name.trim();
    const hit = labels.find((l) => l.name.toLowerCase() === trimmed.toLowerCase());
    if (hit) return hit.id;
    const created = await gmailJson<GmailLabel>("/users/me/labels", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: trimmed,
        labelListVisibility: "labelShow",
        messageListVisibility: "show",
      }),
    });
    return created.id ?? null;
  } catch {
    return null;
  }
}

/**
 * Archive a Gmail message and apply the given label.
 * Best-effort: errors are swallowed so import flows aren't blocked.
 * Returns whether the label was applied and whether the message was archived.
 */
export async function archiveAndLabelMessage(
  gmailMessageId: string,
  labelName: string,
): Promise<{ labeled: boolean; archived: boolean; error?: string }> {
  let labelId: string | null = null;
  try {
    labelId = await ensureLabel(labelName);
  } catch {
    labelId = null;
  }
  const addLabelIds = labelId ? [labelId] : [];
  const removeLabelIds = ["INBOX", "UNREAD"];
  try {
    await modifyLabels(gmailMessageId, addLabelIds, removeLabelIds);
    return { labeled: Boolean(labelId), archived: true };
  } catch (e) {
    return {
      labeled: false,
      archived: false,
      error: e instanceof Error ? e.message : String(e),
    };
  }
}

/* ---------- Sending ---------- */

function base64Url(input: string): string {
  // btoa is available in the Worker runtime.
  return btoa(unescape(encodeURIComponent(input)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

export interface ComposedEmail {
  to: string;
  subject: string;
  body: string;
  fromName?: string | null;
  fromAddress?: string | null;
  inReplyTo?: string | null;
  references?: string | null;
  threadId?: string | null;
}

function buildRawMessage(email: ComposedEmail): string {
  const fromLine = email.fromAddress
    ? `From: ${email.fromName ? `${email.fromName} <${email.fromAddress}>` : email.fromAddress}`
    : null;
  const lines = [
    `To: ${email.to}`,
    fromLine,
    `Subject: ${email.subject}`,
    email.inReplyTo ? `In-Reply-To: ${email.inReplyTo}` : null,
    email.references ? `References: ${email.references}` : null,
    `MIME-Version: 1.0`,
    `Content-Type: text/plain; charset="UTF-8"`,
    `Content-Transfer-Encoding: 7bit`,
    "",
    email.body,
  ].filter(Boolean);
  return base64Url(lines.join("\r\n"));
}

export async function sendEmail(email: ComposedEmail): Promise<{ id: string; threadId: string }> {
  const raw = buildRawMessage(email);
  const payload: Record<string, unknown> = { raw };
  if (email.threadId) payload.threadId = email.threadId;
  return gmailJson<{ id: string; threadId: string }>("/users/me/messages/send", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

/* ---------- HTML sending (multipart/alternative) ---------- */

export interface ComposedHtmlEmail {
  to: string;
  subject: string;
  textBody: string;
  htmlBody: string;
  fromName?: string | null;
  fromAddress?: string | null;
  threadId?: string | null;
}

function buildRawHtmlMessage(email: ComposedHtmlEmail): string {
  const boundary = `==ocsbot_${Math.random().toString(36).slice(2)}_${Date.now()}==`;
  const fromLine = email.fromAddress
    ? `From: ${email.fromName ? `${email.fromName} <${email.fromAddress}>` : email.fromAddress}`
    : null;
  const headers = [
    `To: ${email.to}`,
    fromLine,
    `Subject: ${email.subject}`,
    `MIME-Version: 1.0`,
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
  ].filter(Boolean);
  const parts = [
    `--${boundary}`,
    `Content-Type: text/plain; charset="UTF-8"`,
    `Content-Transfer-Encoding: 7bit`,
    "",
    email.textBody,
    "",
    `--${boundary}`,
    `Content-Type: text/html; charset="UTF-8"`,
    `Content-Transfer-Encoding: 7bit`,
    "",
    email.htmlBody,
    "",
    `--${boundary}--`,
    "",
  ];
  return base64Url([...headers, "", ...parts].join("\r\n"));
}

export async function sendHtmlEmail(email: ComposedHtmlEmail): Promise<{ id: string; threadId: string }> {
  const raw = buildRawHtmlMessage(email);
  const payload: Record<string, unknown> = { raw };
  if (email.threadId) payload.threadId = email.threadId;
  return gmailJson<{ id: string; threadId: string }>("/users/me/messages/send", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

/* ---------- Parsing helpers ---------- */

export function headerValue(headers: GmailHeader[] | undefined, name: string): string | null {
  if (!headers) return null;
  const hit = headers.find((h) => h.name.toLowerCase() === name.toLowerCase());
  return hit?.value ?? null;
}

export function parseFrom(headerVal: string | null): { name: string | null; address: string | null } {
  if (!headerVal) return { name: null, address: null };
  const m = headerVal.match(/^\s*(?:"?([^"<]+?)"?\s*)?<?([^<>\s]+@[^<>\s]+)>?\s*$/);
  if (m) return { name: (m[1] ?? null)?.trim() || null, address: m[2] };
  return { name: null, address: headerVal };
}

export function splitAddresses(headerVal: string | null): string[] {
  if (!headerVal) return [];
  return headerVal
    .split(",")
    .map((s) => parseFrom(s).address ?? s.trim())
    .filter(Boolean);
}

function decodeBase64Url(data: string): string {
  const b64 = data.replace(/-/g, "+").replace(/_/g, "/");
  try {
    return decodeURIComponent(escape(atob(b64)));
  } catch {
    try { return atob(b64); } catch { return ""; }
  }
}

export function extractPlainBody(payload: GmailPayloadPart | undefined): string {
  if (!payload) return "";
  if (payload.mimeType === "text/plain" && payload.body?.data) {
    return decodeBase64Url(payload.body.data);
  }
  if (payload.parts && payload.parts.length) {
    // Prefer text/plain, fall back to first text/* with content
    const plain = payload.parts.find((p) => p.mimeType === "text/plain" && p.body?.data);
    if (plain?.body?.data) return decodeBase64Url(plain.body.data);
    for (const p of payload.parts) {
      const nested = extractPlainBody(p);
      if (nested) return nested;
    }
  }
  return "";
}

export function hasAttachments(payload: GmailPayloadPart | undefined): boolean {
  if (!payload) return false;
  if (payload.filename && payload.filename.length > 0) return true;
  return (payload.parts ?? []).some(hasAttachments);
}

/** Collect filenames of all attachment parts (recursive). */
export function listAttachmentFilenames(payload: GmailPayloadPart | undefined): string[] {
  if (!payload) return [];
  const out: string[] = [];
  if (payload.filename && payload.filename.length > 0) out.push(payload.filename);
  for (const p of payload.parts ?? []) out.push(...listAttachmentFilenames(p));
  return out;
}

/* ---------- Attachment download ---------- */

export interface GmailAttachmentRef {
  filename: string;
  mimeType: string;
  attachmentId: string;
  size: number;
}

/** Recursively collect downloadable attachment refs (parts with attachmentId). */
export function collectAttachmentRefs(payload: GmailPayloadPart | undefined): GmailAttachmentRef[] {
  if (!payload) return [];
  const out: GmailAttachmentRef[] = [];
  if (payload.filename && payload.body?.attachmentId) {
    out.push({
      filename: payload.filename,
      mimeType: payload.mimeType ?? "application/octet-stream",
      attachmentId: payload.body.attachmentId,
      size: payload.body.size ?? 0,
    });
  }
  for (const p of payload.parts ?? []) out.push(...collectAttachmentRefs(p));
  return out;
}

/** Fetch a single attachment's raw base64 data (Gmail returns base64url). */
export async function getAttachmentData(
  messageId: string,
  attachmentId: string,
): Promise<string | null> {
  try {
    const res = await gmailJson<{ data?: string; size?: number }>(
      `/users/me/messages/${messageId}/attachments/${attachmentId}`,
    );
    if (!res.data) return null;
    // Convert base64url -> standard base64 for data URIs.
    return res.data.replace(/-/g, "+").replace(/_/g, "/");
  } catch {
    return null;
  }
}

/* ---------- AI attachment analysis (vision) ---------- */

const AI_GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const AI_MODEL = "google/gemini-3-flash-preview";
const MAX_ATTACHMENTS_TO_SCAN = 4;        // light-touch triage scan
const MAX_ATTACHMENTS_TO_EXTRACT = 10;    // full work-order extraction
const MAX_ATTACHMENT_BYTES = 6 * 1024 * 1024; // 6MB per file

export interface AttachmentAnalysis {
  scanned: number;
  isWorkOrder: boolean;
  confidence: number; // 0..1
  extractedText: string;
  summary: string;
  error?: string;
}

function isVisionMime(mime: string): boolean {
  return /^image\/(png|jpe?g|webp|gif|heic|heif)$/i.test(mime);
}
function isPdfMime(mime: string, filename: string): boolean {
  return /^application\/pdf$/i.test(mime) || /\.pdf$/i.test(filename);
}

/**
 * Send image / PDF attachments to the Lovable AI Gateway (Gemini vision) and
 * ask whether the message contains a work order, plus any extracted text.
 * Returns extractedText that callers can append to the email body so the
 * regex classifier picks up new signals.
 */
export async function analyzeAttachmentsForWorkOrder(
  messageId: string,
  refs: GmailAttachmentRef[],
): Promise<AttachmentAnalysis> {
  const lovableKey = process.env.LOVABLE_API_KEY;
  if (!lovableKey) {
    return { scanned: 0, isWorkOrder: false, confidence: 0, extractedText: "", summary: "", error: "LOVABLE_API_KEY missing" };
  }

  // Pick visual / PDF attachments under the per-file cap, oldest-first up to MAX.
  const candidates = refs
    .filter((r) => (r.size === 0 || r.size <= MAX_ATTACHMENT_BYTES) && (isVisionMime(r.mimeType) || isPdfMime(r.mimeType, r.filename)))
    .slice(0, MAX_ATTACHMENTS_TO_SCAN);

  if (candidates.length === 0) {
    return { scanned: 0, isWorkOrder: false, confidence: 0, extractedText: "", summary: "" };
  }

  const content: Array<Record<string, unknown>> = [
    {
      type: "text",
      text:
        "You are a triage assistant for a UK property maintenance company. Inspect the attached file(s) which were sent to the company inbox. Determine whether they describe a WORK ORDER, JOB INSTRUCTION, REPAIR REQUEST, MAINTENANCE TICKET, PPM, CALL-OUT or similar request to attend a property. " +
        "Extract every useful field you can see (job/work order number, address, postcode, tenant name, contact phone, fault/description, priority, SLA/target date, client reference, trade). " +
        "Respond ONLY as compact JSON with this exact shape: " +
        '{"is_work_order": boolean, "confidence": number_between_0_and_1, "summary": "one short sentence", "extracted_text": "all extracted fields joined as plain text, line-separated, suitable for keyword scanning"}',
    },
  ];

  let scanned = 0;
  for (const ref of candidates) {
    const data = await getAttachmentData(messageId, ref.attachmentId);
    if (!data) continue;
    if (isVisionMime(ref.mimeType)) {
      content.push({
        type: "image_url",
        image_url: { url: `data:${ref.mimeType};base64,${data}` },
      });
      scanned++;
    } else if (isPdfMime(ref.mimeType, ref.filename)) {
      // OpenRouter-style file part — Gemini accepts inline PDFs.
      content.push({
        type: "file",
        file: {
          filename: ref.filename,
          file_data: `data:application/pdf;base64,${data}`,
        },
      });
      scanned++;
    }
  }

  if (scanned === 0) {
    return { scanned: 0, isWorkOrder: false, confidence: 0, extractedText: "", summary: "" };
  }

  let res: Response;
  try {
    res = await fetch(AI_GATEWAY_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${lovableKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: AI_MODEL,
        messages: [{ role: "user", content }],
        response_format: { type: "json_object" },
      }),
    });
  } catch (e) {
    return { scanned, isWorkOrder: false, confidence: 0, extractedText: "", summary: "", error: e instanceof Error ? e.message : String(e) };
  }

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    return { scanned, isWorkOrder: false, confidence: 0, extractedText: "", summary: "", error: `AI ${res.status}: ${text.slice(0, 200)}` };
  }

  let parsed: { choices?: Array<{ message?: { content?: string } }> };
  try { parsed = await res.json(); } catch { return { scanned, isWorkOrder: false, confidence: 0, extractedText: "", summary: "", error: "AI: invalid JSON envelope" }; }
  const raw = parsed.choices?.[0]?.message?.content ?? "";
  let json: { is_work_order?: boolean; confidence?: number; summary?: string; extracted_text?: string } = {};
  try {
    // Strip ```json fences if present
    const cleaned = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
    json = JSON.parse(cleaned);
  } catch {
    // fall through with empty
  }

  return {
    scanned,
    isWorkOrder: Boolean(json.is_work_order),
    confidence: typeof json.confidence === "number" ? Math.max(0, Math.min(1, json.confidence)) : 0,
    extractedText: typeof json.extracted_text === "string" ? json.extracted_text.slice(0, 8000) : "",
    summary: typeof json.summary === "string" ? json.summary.slice(0, 500) : "",
  };
}

/* ---------- Multi work-order extraction ---------- */

export interface ExtractedWorkOrder {
  order_no: string | null;
  client_name: string | null;
  address_line_1: string | null;
  city: string | null;
  postcode: string | null;
  postcode_zone: string | null;
  job_summary: string | null;
  job_description: string | null;
  contact_name: string | null;
  contact_phone: string | null;
  priority_level: "low" | "normal" | "high" | "urgent" | null;
  confidence: number; // 0..1 — how complete/sure this single WO is
  missing_fields: string[];
  notes: string | null;
}

export interface WorkOrderExtraction {
  workOrders: ExtractedWorkOrder[];
  extractedText: string;
  summary: string;
  scannedAttachments: number;
  error?: string;
}

function deriveZone(postcode?: string | null): string | null {
  if (!postcode) return null;
  const m = postcode.toUpperCase().match(/^[A-Z]{1,2}\d{1,2}[A-Z]?/);
  return m ? m[0] : null;
}

/**
 * Scan the email body + image/PDF attachments and pull out one OR MULTIPLE
 * work orders. Each work order is returned with structured fields so the
 * caller can create one intake record per detected job. Dispatcher/boss
 * then verifies time + quote in the intake review screen before approving
 * into the awaiting-dispatch queue.
 */
export async function extractWorkOrdersFromGmail(input: {
  messageId: string;
  subject: string | null;
  body: string | null;
  fromAddress: string | null;
  attachments: GmailAttachmentRef[];
}): Promise<WorkOrderExtraction> {
  const lovableKey = process.env.LOVABLE_API_KEY;
  if (!lovableKey) {
    return { workOrders: [], extractedText: "", summary: "", scannedAttachments: 0, error: "LOVABLE_API_KEY missing" };
  }

  const visualRefs = input.attachments
    .filter((r) => (r.size === 0 || r.size <= MAX_ATTACHMENT_BYTES) && (isVisionMime(r.mimeType) || isPdfMime(r.mimeType, r.filename)))
    .slice(0, MAX_ATTACHMENTS_TO_EXTRACT);

  const userContent: Array<Record<string, unknown>> = [];
  const headerText =
    `EMAIL METADATA\n` +
    `From: ${input.fromAddress ?? "(unknown)"}\n` +
    `Subject: ${input.subject ?? "(no subject)"}\n\n` +
    `EMAIL BODY (text):\n${(input.body ?? "").slice(0, 12000)}`;

  userContent.push({
    type: "text",
    text:
      "You are the OCS intake parser for a UK property maintenance company. " +
      "Given the email body and any attached images / PDFs (photos of paper work orders, scanned job sheets, screenshots), " +
      "OCR every attachment and extract WORK ORDERS. " +
      "A single email may describe ONE OR MULTIPLE distinct work orders — each property address / job is a separate work order. " +
      "For every work order pull: order_no (any reference visible — WO#, job no, client ref), client_name, address_line_1, city, postcode, postcode_zone (UK outward code e.g. NW1), job_summary (one short sentence), job_description (full detail), contact_name, contact_phone and priority_level (urgent|high|normal|low). " +
      "Return strict JSON ONLY, matching this exact shape: " +
      '{"summary":"one sentence overall summary","extracted_text":"plain-text OCR of every attachment, line-separated","work_orders":[' +
      '{"order_no":null,"client_name":null,"address_line_1":null,"city":null,"postcode":null,"postcode_zone":null,' +
      '"job_summary":null,"job_description":null,"contact_name":null,"contact_phone":null,' +
      '"priority_level":null,"confidence":0.0,"missing_fields":[],"notes":null}' +
      "]}. " +
      "Use null (not empty string) for unknown fields. confidence is 0..1 reflecting how complete that single work order is. " +
      "missing_fields lists any of [address_line_1, postcode, job_summary, contact_phone] you could not fill. " +
      "If the email is clearly NOT a work order, return work_orders: []. " +
      "Never invent values. Never repeat the same job twice. Keep extracted_text under 8000 characters.",
  });
  userContent.push({ type: "text", text: headerText });

  let scanned = 0;
  for (const ref of visualRefs) {
    const data = await getAttachmentData(input.messageId, ref.attachmentId);
    if (!data) continue;
    if (isVisionMime(ref.mimeType)) {
      userContent.push({ type: "image_url", image_url: { url: `data:${ref.mimeType};base64,${data}` } });
      scanned++;
    } else if (isPdfMime(ref.mimeType, ref.filename)) {
      userContent.push({ type: "file", file: { filename: ref.filename, file_data: `data:application/pdf;base64,${data}` } });
      scanned++;
    }
  }

  let res: Response;
  try {
    res = await fetch(AI_GATEWAY_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${lovableKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: AI_MODEL,
        messages: [{ role: "user", content: userContent }],
        response_format: { type: "json_object" },
      }),
    });
  } catch (e) {
    return { workOrders: [], extractedText: "", summary: "", scannedAttachments: scanned, error: e instanceof Error ? e.message : String(e) };
  }

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    return { workOrders: [], extractedText: "", summary: "", scannedAttachments: scanned, error: `AI ${res.status}: ${text.slice(0, 200)}` };
  }

  let envelope: { choices?: Array<{ message?: { content?: string } }> };
  try { envelope = await res.json(); } catch { return { workOrders: [], extractedText: "", summary: "", scannedAttachments: scanned, error: "AI: invalid JSON envelope" }; }
  const raw = envelope.choices?.[0]?.message?.content ?? "";
  let parsed: { work_orders?: unknown[]; extracted_text?: string; summary?: string } = {};
  try {
    const cleaned = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
    parsed = JSON.parse(cleaned);
  } catch {
    return { workOrders: [], extractedText: "", summary: "", scannedAttachments: scanned, error: "AI: could not parse work-order JSON" };
  }

  const list = Array.isArray(parsed.work_orders) ? parsed.work_orders : [];
  const workOrders: ExtractedWorkOrder[] = list
    .map((row): ExtractedWorkOrder | null => {
      if (!row || typeof row !== "object") return null;
      const r = row as Record<string, unknown>;
      const str = (k: string): string | null => {
        const v = r[k];
        if (typeof v !== "string") return null;
        const t = v.trim();
        return t.length === 0 || t.toLowerCase() === "null" ? null : t;
      };
      const postcode = str("postcode");
      return {
        order_no: str("order_no"),
        client_name: str("client_name"),
        address_line_1: str("address_line_1"),
        city: str("city"),
        postcode,
        postcode_zone: str("postcode_zone") ?? deriveZone(postcode),
        job_summary: str("job_summary"),
        job_description: str("job_description"),
        contact_name: str("contact_name"),
        contact_phone: str("contact_phone"),
        priority_level: (["low", "normal", "high", "urgent"].includes(String(r.priority_level)) ? r.priority_level : null) as ExtractedWorkOrder["priority_level"],
        confidence: typeof r.confidence === "number" ? Math.max(0, Math.min(1, r.confidence)) : 0,
        missing_fields: Array.isArray(r.missing_fields) ? (r.missing_fields as unknown[]).filter((x): x is string => typeof x === "string") : [],
        notes: str("notes"),
      };
    })
    .filter((x): x is ExtractedWorkOrder => x !== null);

  return {
    workOrders,
    extractedText: typeof parsed.extracted_text === "string" ? parsed.extracted_text.slice(0, 12000) : "",
    summary: typeof parsed.summary === "string" ? parsed.summary.slice(0, 500) : "",
    scannedAttachments: scanned,
  };
}

/* ---------- Work-order sniffer ---------- */

export interface ClassificationResult {
  isWorkOrder: boolean;
  score: number; // 0..1
  reasons: string[];
}

const WO_SUBJECT_PATTERNS = [
  /\bwork[\s-]?order\b/i,
  /\bjob\s+(?:ref|reference|number|no\.?)\b/i,
  /\brepair\b/i,
  /\bmaintenance\b/i,
  /\bcall[\s-]?out\b/i,
  /\bfault\b/i,
  /\bleak(ing)?\b/i,
  /\bboiler\b/i,
  /\bno\s+(?:heating|hot\s+water|power)\b/i,
  /\binstruction\s+to\s+attend\b/i,
  /\bplease\s+attend\b/i,
  /\b(?:wo|w\/o|job|ref|po)\s*[#:\-]?\s*\d{3,}\b/i,
  /\b(?:service|maintenance)\s+request\b/i,
  /\bdispatch(ed)?\b/i,
  /\bticket\b/i,
  /\bppm\b/i,
  /\bremedial\b/i,
  /\bmake\s+safe\b/i,
  /\bsite\s+visit\b/i,
  /\battendance\s+required\b/i,
  /\bnew\s+(?:job|order|instruction)\b/i,
  /\bemergency\b/i,
  /\bblocked\s+(?:drain|toilet|sink)\b/i,
  /\belectrical\b/i,
  /\bplumbing\b/i,
];

const WO_BODY_PATTERNS = [
  /\btenant\b/i,
  /\baddress\b/i,
  /\bpostcode\b/i,
  /\bcontact\s+(?:name|number|phone)\b/i,
  /\baccess\b/i,
  /\bSOR\b/,
  /\border\s+(?:no\.?|number|ref)\b/i,
  /\bjob\s+(?:no\.?|number|ref|reference|id)\b/i,
  /\bwork\s+order\b/i,
  /\bproperty\b/i,
  /\bsite\s+address\b/i,
  /\bengineer\b/i,
  /\battend\b/i,
  /\bpriority\b/i,
  /\bSLA\b/,
  /\bETA\b/,
  /\bdescription\s+of\s+(?:works?|fault|issue|problem)\b/i,
  /\bscope\s+of\s+works?\b/i,
  /\binstructed?\b/i,
  /\breported\s+(?:fault|issue|problem)\b/i,
  /\btarget\s+(?:date|time|completion)\b/i,
  /\bclient\s+ref\b/i,
];

const WO_ATTACHMENT_PATTERNS = [
  /work[\s_\-]?order/i,
  /\bwo[\s_\-]?\d/i,
  /\bjob[\s_\-]?(?:sheet|ticket|card|\d)/i,
  /instruction/i,
  /dispatch/i,
  /service[\s_\-]?request/i,
  /\bSOR\b/,
  /repair/i,
  /maintenance/i,
  /ppm/i,
  /callout/i,
];

export function classifyEmail(input: {
  subject: string | null;
  body: string | null;
  fromAddress: string | null;
  hasAttachments: boolean;
  attachmentFilenames?: string[];
  knownSenderDomains?: string[];
  aiVerdict?: { isWorkOrder: boolean; confidence: number; summary?: string } | null;
}): ClassificationResult {
  const reasons: string[] = [];
  let score = 0;

  const subj = input.subject ?? "";
  for (const re of WO_SUBJECT_PATTERNS) {
    if (re.test(subj)) { score += 0.18; reasons.push(`subject matches /${re.source}/`); break; }
  }

  const body = input.body ?? "";
  let bodyHits = 0;
  for (const re of WO_BODY_PATTERNS) {
    if (re.test(body)) bodyHits++;
  }
  if (bodyHits >= 3) { score += 0.35; reasons.push(`body has ${bodyHits} work-order signals`); }
  else if (bodyHits === 2) { score += 0.22; reasons.push(`body has 2 work-order signals`); }
  else if (bodyHits === 1) { score += 0.10; reasons.push(`body has 1 work-order signal`); }

  // Postcode pattern (UK)
  if (/\b[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}\b/i.test(body)) {
    score += 0.18; reasons.push("UK postcode detected");
  }

  // UK phone-ish number in body
  if (/(?:\+44\s?|0)(?:\d\s?){9,10}\b/.test(body)) {
    score += 0.08; reasons.push("phone number in body");
  }

  const filenames = input.attachmentFilenames ?? [];
  if (filenames.length > 0) {
    score += 0.12; reasons.push(`has ${filenames.length} attachment(s)`);
    const docLike = filenames.filter((n) => /\.(pdf|docx?|xlsx?|csv|rtf)$/i.test(n));
    if (docLike.length > 0) {
      score += 0.20;
      reasons.push(`document attachment(s): ${docLike.slice(0, 3).join(", ")}`);
    }
    let matched: string | null = null;
    for (const name of filenames) {
      for (const re of WO_ATTACHMENT_PATTERNS) {
        if (re.test(name)) { matched = name; break; }
      }
      if (matched) break;
    }
    if (matched) {
      score += 0.30;
      reasons.push(`attachment name looks like a work order: ${matched}`);
    }
  } else if (input.hasAttachments) {
    score += 0.10; reasons.push("has attachment(s)");
  }

  const domain = (input.fromAddress ?? "").split("@")[1]?.toLowerCase() ?? "";
  if (domain && (input.knownSenderDomains ?? []).includes(domain)) {
    score += 0.30; reasons.push(`known sender domain: ${domain}`);
  }

  // Negative signals
  if (/\bunsubscribe\b/i.test(body) || /\bnewsletter\b/i.test(subj + " " + body)) {
    score -= 0.30; reasons.push("marketing / unsubscribe signal");
  }
  if (/\b(?:payment\s+received|receipt|statement)\b/i.test(subj)) {
    score -= 0.15; reasons.push("billing-type subject");
  }

  // AI vision verdict from attachment scan — strongest signal we have.
  if (input.aiVerdict) {
    if (input.aiVerdict.isWorkOrder) {
      const boost = 0.5 + 0.3 * (input.aiVerdict.confidence ?? 0);
      score += boost;
      reasons.push(
        `AI attachment scan: work order (conf ${(input.aiVerdict.confidence ?? 0).toFixed(2)})${input.aiVerdict.summary ? ` — ${input.aiVerdict.summary}` : ""}`,
      );
    } else if ((input.aiVerdict.confidence ?? 0) > 0.7) {
      score -= 0.15;
      reasons.push(`AI attachment scan: not a work order (conf ${input.aiVerdict.confidence.toFixed(2)})`);
    }
  }

  score = Math.max(0, Math.min(1, score));
  return {
    isWorkOrder: score >= 0.35,
    score,
    reasons,
  };
}