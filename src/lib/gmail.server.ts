/**
 * Server-only helpers for talking to Gmail via the Lovable connector gateway.
 * NEVER import this file from client code. The `.server.ts` suffix is
 * enforced by the bundler.
 */

import { supabaseAdmin } from "@/integrations/supabase/client.server";

const GMAIL_API = "https://gmail.googleapis.com/gmail/v1";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";

export const GMAIL_OAUTH_SCOPES = [
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/gmail.send",
  "https://www.googleapis.com/auth/gmail.modify",
  "https://www.googleapis.com/auth/userinfo.email",
  "https://www.googleapis.com/auth/userinfo.profile",
];

export function googleOAuthCreds(): { clientId: string; clientSecret: string } {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error("Google OAuth is not configured (missing GOOGLE_OAUTH_CLIENT_ID/SECRET).");
  }
  return { clientId, clientSecret };
}

/** Read the current Boss-linked Google tokens (server-only). */
async function readTokens() {
  const { data, error } = await supabaseAdmin
    .from("gmail_oauth_secrets" as never)
    .select("access_token, refresh_token, expires_at, scope")
    .eq("singleton", true)
    .maybeSingle();
  if (error) throw new Error(`Failed to load Gmail tokens: ${error.message}`);
  return data as
    | { access_token: string; refresh_token: string | null; expires_at: string; scope: string | null }
    | null;
}

/** True when a Boss has completed the OAuth flow and we have tokens to use. */
export async function isGmailLinked(): Promise<boolean> {
  const t = await readTokens();
  return Boolean(t?.access_token && t?.refresh_token);
}

async function refreshAccessToken(refreshToken: string): Promise<{ access_token: string; expires_in: number; scope?: string }> {
  const { clientId, clientSecret } = googleOAuthCreds();
  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: refreshToken,
    grant_type: "refresh_token",
  });
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Token refresh failed (${res.status}): ${text.slice(0, 300)}`);
  return JSON.parse(text);
}

async function getValidAccessToken(): Promise<string> {
  const t = await readTokens();
  if (!t) throw new Error("Gmail mailbox is not connected. Boss must link it from Infrastructure.");
  const expiresAt = new Date(t.expires_at).getTime();
  const skewMs = 60_000; // refresh 1 min early
  if (Date.now() < expiresAt - skewMs) return t.access_token;
  if (!t.refresh_token) throw new Error("Google session expired and no refresh token is available. Please reconnect.");
  const refreshed = await refreshAccessToken(t.refresh_token);
  const newExpiresAt = new Date(Date.now() + (refreshed.expires_in - 30) * 1000).toISOString();
  await supabaseAdmin
    .from("gmail_oauth_secrets" as never)
    .update({
      access_token: refreshed.access_token,
      expires_at: newExpiresAt,
      scope: refreshed.scope ?? t.scope,
      updated_at: new Date().toISOString(),
    } as never)
    .eq("singleton", true);
  return refreshed.access_token;
}

async function gmailFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const token = await getValidAccessToken();
  return fetch(`${GMAIL_API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
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
];

const WO_BODY_PATTERNS = [
  /\btenant\b/i,
  /\baddress\b/i,
  /\bpostcode\b/i,
  /\bcontact\s+(?:name|number|phone)\b/i,
  /\baccess\b/i,
  /\bSOR\b/,
  /\border\s+(?:no\.?|number|ref)\b/i,
];

export function classifyEmail(input: {
  subject: string | null;
  body: string | null;
  fromAddress: string | null;
  hasAttachments: boolean;
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
  if (bodyHits >= 2) { score += 0.25; reasons.push(`body has ${bodyHits} work-order signals`); }
  else if (bodyHits === 1) { score += 0.10; reasons.push(`body has 1 work-order signal`); }

  // Postcode pattern (UK)
  if (/\b[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}\b/i.test(body)) {
    score += 0.18; reasons.push("UK postcode detected");
  }

  if (input.hasAttachments) { score += 0.10; reasons.push("has attachment(s)"); }

  const domain = (input.fromAddress ?? "").split("@")[1]?.toLowerCase() ?? "";
  if (domain && (input.knownSenderDomains ?? []).includes(domain)) {
    score += 0.30; reasons.push(`known sender domain: ${domain}`);
  }

  // Negative signals
  if (/\bunsubscribe\b/i.test(body) || /\bnewsletter\b/i.test(subj + " " + body)) {
    score -= 0.30; reasons.push("marketing / unsubscribe signal");
  }
  if (/\b(?:invoice|payment\s+received|receipt)\b/i.test(subj)) {
    score -= 0.15; reasons.push("billing-type subject");
  }

  score = Math.max(0, Math.min(1, score));
  return {
    isWorkOrder: score >= 0.4,
    score,
    reasons,
  };
}