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

  score = Math.max(0, Math.min(1, score));
  return {
    isWorkOrder: score >= 0.35,
    score,
    reasons,
  };
}