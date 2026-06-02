// Telegram-driven outbound email workflow for OCSBot.
// Lists site contacts with email addresses, manages a per-chat compose
// session (subject -> body -> confirm), and sends through the linked
// company Gmail account. Recipient sees a normal email — no Telegram
// branding is exposed in the message itself.

import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  getGmailProfile,
  isGmailLinked,
  sendHtmlEmail,
} from "@/lib/gmail.server";
import { escapeHtml, type ActionResult, type InlineKeyboard } from "@/lib/telegramConsole.server";

const PAGE_SIZE = 8;

export type ContactKind = "client" | "external_contact";

export interface EmailContact {
  kind: ContactKind;
  id: string;
  name: string;
  email: string;
  label?: string | null; // organisation / client type
}

/* ---------- signature ---------- */

export interface EmailSignature {
  company_name: string;
  tagline: string;
  phone: string;
  email: string;
  website: string;
  address: string;
  logo_url: string;
}

const DEFAULT_SIGNATURE: EmailSignature = {
  company_name: "OCS - On Call Service",
  tagline: "Property maintenance & repairs",
  phone: "",
  email: "",
  website: "https://ocsportal.co.uk",
  address: "",
  logo_url: "https://ocsportal.lovable.app/ocs-logo.png",
};

export async function loadSignature(): Promise<EmailSignature> {
  const { data } = await supabaseAdmin
    .from("company_settings")
    .select("email_signature")
    .eq("singleton", true)
    .maybeSingle();
  const raw = (data as { email_signature?: Partial<EmailSignature> } | null)?.email_signature ?? {};
  return { ...DEFAULT_SIGNATURE, ...raw };
}

export function renderSignatureHtml(sig: EmailSignature): string {
  const rows: string[] = [];
  if (sig.phone) rows.push(`📞 <a href="tel:${escapeHtml(sig.phone)}" style="color:#555;text-decoration:none;">${escapeHtml(sig.phone)}</a>`);
  if (sig.email) rows.push(`✉️ <a href="mailto:${escapeHtml(sig.email)}" style="color:#555;text-decoration:none;">${escapeHtml(sig.email)}</a>`);
  if (sig.website) rows.push(`🌐 <a href="${escapeHtml(sig.website)}" style="color:#555;text-decoration:none;">${escapeHtml(sig.website.replace(/^https?:\/\//, ""))}</a>`);
  if (sig.address) rows.push(`📍 ${escapeHtml(sig.address)}`);
  return `
<table cellpadding="0" cellspacing="0" border="0" style="margin-top:28px;padding-top:16px;border-top:1px solid #e5e7eb;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#555;">
  <tr>
    ${sig.logo_url ? `<td style="vertical-align:top;padding-right:14px;"><img src="${escapeHtml(sig.logo_url)}" alt="${escapeHtml(sig.company_name)}" height="48" style="display:block;border:0;outline:none;text-decoration:none;height:48px;width:auto;"/></td>` : ""}
    <td style="vertical-align:top;line-height:1.45;">
      <div style="font-weight:600;color:#111;font-size:14px;">${escapeHtml(sig.company_name)}</div>
      ${sig.tagline ? `<div style="color:#777;font-size:12px;margin-bottom:6px;">${escapeHtml(sig.tagline)}</div>` : ""}
      ${rows.join("<br/>")}
    </td>
  </tr>
</table>`.trim();
}

export function renderSignatureText(sig: EmailSignature): string {
  const lines = ["", "--", sig.company_name];
  if (sig.tagline) lines.push(sig.tagline);
  if (sig.phone) lines.push(`Tel: ${sig.phone}`);
  if (sig.email) lines.push(`Email: ${sig.email}`);
  if (sig.website) lines.push(`Web: ${sig.website}`);
  if (sig.address) lines.push(sig.address);
  return lines.join("\n");
}

/* ---------- contact listing ---------- */

export async function countEmailContacts(): Promise<number> {
  const [{ count: c1 }, { count: c2 }] = await Promise.all([
    supabaseAdmin.from("clients").select("id", { count: "exact", head: true }).not("contact_email", "is", null).neq("contact_email", ""),
    supabaseAdmin.from("external_contacts").select("id", { count: "exact", head: true }).not("email", "is", null).neq("email", ""),
  ]);
  return (c1 ?? 0) + (c2 ?? 0);
}

export async function listEmailContactsPage(page: number): Promise<{ rows: EmailContact[]; total: number }> {
  // Pull a generous slab from both tables, merge, sort, slice.
  const cap = (page + 1) * PAGE_SIZE * 2 + PAGE_SIZE;
  const [{ data: clients }, { data: contacts }, total] = await Promise.all([
    supabaseAdmin
      .from("clients")
      .select("id, client_name, client_type, contact_email, contact_name")
      .not("contact_email", "is", null)
      .neq("contact_email", "")
      .order("client_name", { ascending: true })
      .limit(cap),
    supabaseAdmin
      .from("external_contacts")
      .select("id, name, organization, role_label, email")
      .not("email", "is", null)
      .neq("email", "")
      .order("name", { ascending: true })
      .limit(cap),
    countEmailContacts(),
  ]);

  const merged: EmailContact[] = [];
  for (const c of (clients ?? []) as Array<{ id: string; client_name: string; client_type: string; contact_email: string; contact_name: string | null }>) {
    const email = (c.contact_email ?? "").trim();
    if (!email.includes("@")) continue;
    merged.push({
      kind: "client",
      id: c.id,
      name: c.contact_name?.trim() || c.client_name,
      email,
      label: c.client_type ? `${c.client_name} · ${c.client_type}` : c.client_name,
    });
  }
  for (const c of (contacts ?? []) as Array<{ id: string; name: string; organization: string | null; role_label: string | null; email: string }>) {
    const email = (c.email ?? "").trim();
    if (!email.includes("@")) continue;
    merged.push({
      kind: "external_contact",
      id: c.id,
      name: c.name,
      email,
      label: [c.organization, c.role_label].filter(Boolean).join(" · ") || null,
    });
  }

  merged.sort((a, b) => a.name.localeCompare(b.name, "en-GB", { sensitivity: "base" }));
  const from = page * PAGE_SIZE;
  return { rows: merged.slice(from, from + PAGE_SIZE), total };
}

export async function findEmailContact(kind: ContactKind, id: string): Promise<EmailContact | null> {
  if (kind === "client") {
    const { data } = await supabaseAdmin
      .from("clients")
      .select("id, client_name, client_type, contact_email, contact_name")
      .eq("id", id)
      .maybeSingle();
    if (!data) return null;
    const row = data as { id: string; client_name: string; client_type: string; contact_email: string | null; contact_name: string | null };
    const email = (row.contact_email ?? "").trim();
    if (!email.includes("@")) return null;
    return {
      kind: "client",
      id: row.id,
      name: row.contact_name?.trim() || row.client_name,
      email,
      label: row.client_type ? `${row.client_name} · ${row.client_type}` : row.client_name,
    };
  }
  const { data } = await supabaseAdmin
    .from("external_contacts")
    .select("id, name, organization, role_label, email")
    .eq("id", id)
    .maybeSingle();
  if (!data) return null;
  const row = data as { id: string; name: string; organization: string | null; role_label: string | null; email: string | null };
  const email = (row.email ?? "").trim();
  if (!email.includes("@")) return null;
  return {
    kind: "external_contact",
    id: row.id,
    name: row.name,
    email,
    label: [row.organization, row.role_label].filter(Boolean).join(" · ") || null,
  };
}

/* ---------- compose session state ---------- */

export type ComposeStage = "await_subject" | "await_body" | "await_confirm";

// Additional stage "await_mode" — used right after picking a contact to ask
// the operator whether they want to start from a template or write from
// scratch. Stored on the same table; older sessions remain compatible.
export type ExtendedComposeStage = ComposeStage | "await_mode";

export interface ComposeSession {
  chat_id: string;
  stage: ComposeStage;
  contact_kind: ContactKind | null;
  contact_id: string | null;
  contact_name: string | null;
  contact_email: string | null;
  subject: string | null;
  body: string | null;
  actor_profile_id: string | null;
}

export async function getSession(chatId: number): Promise<ComposeSession | null> {
  const { data } = await supabaseAdmin
    .from("telegram_email_sessions")
    .select("chat_id, stage, contact_kind, contact_id, contact_name, contact_email, subject, body, actor_profile_id")
    .eq("chat_id", String(chatId))
    .maybeSingle();
  return (data as ComposeSession | null) ?? null;
}

export async function upsertSession(s: Omit<ComposeSession, "chat_id"> & { chat_id: string }): Promise<void> {
  await supabaseAdmin.from("telegram_email_sessions").upsert({
    chat_id: s.chat_id,
    stage: s.stage,
    contact_kind: s.contact_kind,
    contact_id: s.contact_id,
    contact_name: s.contact_name,
    contact_email: s.contact_email,
    subject: s.subject,
    body: s.body,
    actor_profile_id: s.actor_profile_id,
    updated_at: new Date().toISOString(),
  } as never);
}

export async function clearSession(chatId: number): Promise<void> {
  await supabaseAdmin.from("telegram_email_sessions").delete().eq("chat_id", String(chatId));
}

/* ---------- presentation helpers ---------- */

export function paginate(key: string, page: number, hasMore: boolean): InlineKeyboard {
  const row: Array<{ text: string; callback_data: string }> = [];
  if (page > 0) row.push({ text: "« Prev", callback_data: `${key}:${page - 1}` });
  row.push({ text: "🔄 Refresh", callback_data: `${key}:${page}` });
  if (hasMore) row.push({ text: "Next »", callback_data: `${key}:${page + 1}` });
  return { inline_keyboard: [row] };
}

export async function emailsTabAction(page: number): Promise<ActionResult> {
  const linked = await isGmailLinked();
  if (!linked) {
    return { text: "📧 <b>Emails</b>\n❌ The company Gmail account is not connected. Reconnect it in Lovable Connectors before sending." };
  }
  const { rows, total } = await listEmailContactsPage(page);
  if (total === 0) {
    return { text: "📧 <b>Emails</b>\nNo contacts with email addresses on file yet." };
  }
  if (rows.length === 0) {
    return { text: `📧 <b>Emails</b>\nNo more contacts on page ${page + 1}.` };
  }
  const lines = rows.map((r, i) => {
    const n = page * PAGE_SIZE + i + 1;
    const label = r.label ? `\n<i>${escapeHtml(r.label)}</i>` : "";
    return `<b>${n}. ${escapeHtml(r.name)}</b>${label}\n✉️ <code>${escapeHtml(r.email)}</code>`;
  });
  const inline: Array<Array<{ text: string; callback_data: string }>> = [];
  rows.forEach((r, i) => {
    const n = page * PAGE_SIZE + i + 1;
    const data = `em:pick:${r.kind === "client" ? "c" : "x"}:${r.id}`;
    inline.push([{ text: `✉️ #${n} ${truncate(r.name, 28)}`, callback_data: data }]);
  });
  const hasMore = total > (page + 1) * PAGE_SIZE;
  const pag = paginate("em:list", page, hasMore);
  for (const row of pag.inline_keyboard) {
    inline.push(row.map((b) => ({ text: b.text, callback_data: b.callback_data ?? "" })));
  }
  const header = `📧 <b>Emails — choose a recipient</b>\nTotal: ${total} · showing ${page * PAGE_SIZE + 1}–${page * PAGE_SIZE + rows.length}`;
  return {
    text: `${header}\n\n${lines.join("\n\n")}`,
    reply_markup: { inline_keyboard: inline },
  };
}

function truncate(s: string, n: number): string {
  return s.length > n ? `${s.slice(0, n - 1)}…` : s;
}

/* ---------- compose flow steps ---------- */

export async function startCompose(args: {
  chatId: number;
  actorProfileId: string;
  kind: ContactKind;
  contactId: string;
}): Promise<ActionResult> {
  const contact = await findEmailContact(args.kind, args.contactId);
  if (!contact) return { text: "❌ Contact not found or has no email address." };
  await upsertSession({
    chat_id: String(args.chatId),
    stage: "await_mode" as ComposeStage,
    contact_kind: contact.kind,
    contact_id: contact.id,
    contact_name: contact.name,
    contact_email: contact.email,
    subject: null,
    body: null,
    actor_profile_id: args.actorProfileId,
  });
  return {
    text:
      `✉️ <b>New email to ${escapeHtml(contact.name)}</b>\n` +
      `<code>${escapeHtml(contact.email)}</code>\n\n` +
      `How would you like to compose this email?`,
    reply_markup: {
      inline_keyboard: [
        [{ text: "📋 Use template", callback_data: "em:tpls" }],
        [{ text: "✍️ Write custom email", callback_data: "em:custom" }],
        [{ text: "❌ Cancel", callback_data: "em:cancel" }],
      ],
    },
  };
}

/* ---------- template-driven compose ---------- */

interface DbTemplateRow {
  id: string;
  name: string;
  subject: string;
  body: string;
  sort_order: number;
}

async function listActiveTemplates(): Promise<DbTemplateRow[]> {
  const { data } = await supabaseAdmin
    .from("email_templates")
    .select("id, name, subject, body, sort_order")
    .eq("is_active", true)
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });
  return (data ?? []) as DbTemplateRow[];
}

function applyTemplatePlaceholders(text: string, contactName: string | null): string {
  const name = contactName?.trim() || "there";
  return text.replace(/\{\{\s*name\s*\}\}/gi, name);
}

export async function showTemplatePicker(chatId: number): Promise<ActionResult> {
  const session = await getSession(chatId);
  if (!session?.contact_email) {
    return { text: "No active compose. Tap 📧 Emails to start." };
  }
  const templates = await listActiveTemplates();
  if (templates.length === 0) {
    return {
      text:
        "No active email templates yet. Add some under <b>Site settings → Email templates</b>, " +
        "or write a custom email instead.",
      reply_markup: {
        inline_keyboard: [
          [{ text: "✍️ Write custom email", callback_data: "em:custom" }],
          [{ text: "❌ Cancel", callback_data: "em:cancel" }],
        ],
      },
    };
  }
  const rows = templates.map((t) => [{ text: `📋 ${truncate(t.name, 36)}`, callback_data: `em:tpl:${t.id}` }]);
  rows.push([{ text: "✍️ Write custom email", callback_data: "em:custom" }]);
  rows.push([{ text: "❌ Cancel", callback_data: "em:cancel" }]);
  return {
    text: `📋 <b>Choose a template</b> for ${escapeHtml(session.contact_name ?? "")}`,
    reply_markup: { inline_keyboard: rows },
  };
}

export async function startCustomCompose(chatId: number): Promise<ActionResult> {
  const session = await getSession(chatId);
  if (!session?.contact_email) {
    return { text: "No active compose. Tap 📧 Emails to start." };
  }
  await upsertSession({
    ...session,
    chat_id: String(chatId),
    stage: "await_subject",
    subject: null,
    body: null,
  });
  return {
    text:
      `📝 <b>Step 1 of 2 — Subject line</b>\nReply with the subject for this email.\n\n` +
      `Tap Cancel any time to abort.`,
    reply_markup: { inline_keyboard: [[{ text: "❌ Cancel", callback_data: "em:cancel" }]] },
  };
}

export async function applyTemplate(chatId: number, templateId: string): Promise<ActionResult> {
  const session = await getSession(chatId);
  if (!session?.contact_email) {
    return { text: "No active compose. Tap 📧 Emails to start." };
  }
  const { data } = await supabaseAdmin
    .from("email_templates")
    .select("id, name, subject, body, is_active")
    .eq("id", templateId)
    .maybeSingle();
  const tpl = data as { id: string; name: string; subject: string; body: string; is_active: boolean } | null;
  if (!tpl || !tpl.is_active) {
    return { text: "❌ That template is no longer available." };
  }
  const subject = applyTemplatePlaceholders(tpl.subject, session.contact_name);
  const body = applyTemplatePlaceholders(tpl.body, session.contact_name);
  await upsertSession({
    ...session,
    chat_id: String(chatId),
    stage: "await_confirm",
    subject,
    body,
  });
  return renderConfirm(chatId, `📋 Template loaded: <b>${escapeHtml(tpl.name)}</b>`);
}

export async function editSubject(chatId: number): Promise<ActionResult> {
  const session = await getSession(chatId);
  if (!session?.contact_email) {
    return { text: "No active compose. Tap 📧 Emails to start." };
  }
  await upsertSession({ ...session, chat_id: String(chatId), stage: "await_subject" });
  return {
    text:
      `✏️ <b>Edit subject</b>\nCurrent: <code>${escapeHtml(session.subject ?? "")}</code>\n\n` +
      `Reply with the new subject line.`,
    reply_markup: { inline_keyboard: [[{ text: "❌ Cancel", callback_data: "em:cancel" }]] },
  };
}

export async function editBody(chatId: number): Promise<ActionResult> {
  const session = await getSession(chatId);
  if (!session?.contact_email) {
    return { text: "No active compose. Tap 📧 Emails to start." };
  }
  await upsertSession({ ...session, chat_id: String(chatId), stage: "await_body" });
  return {
    text:
      `✏️ <b>Edit message</b>\nReply with the new body. Line breaks are kept; ` +
      `the company signature is added automatically.`,
    reply_markup: { inline_keyboard: [[{ text: "❌ Cancel", callback_data: "em:cancel" }]] },
  };
}

async function renderConfirm(chatId: number, prefix?: string): Promise<ActionResult> {
  const session = await getSession(chatId);
  if (!session?.contact_email || !session.subject || !session.body) {
    return { text: "No active compose. Tap 📧 Emails to start." };
  }
  let fromAddress = "(company Gmail)";
  try {
    const prof = await getGmailProfile();
    fromAddress = prof.emailAddress;
  } catch { /* show fallback */ }

  const preview = session.body.length > 600 ? `${session.body.slice(0, 600)}…` : session.body;
  return {
    text:
      (prefix ? `${prefix}\n\n` : "") +
      `📨 <b>Ready to send — confirm</b>\n\n` +
      `<b>To:</b> ${escapeHtml(session.contact_name ?? "")} &lt;${escapeHtml(session.contact_email)}&gt;\n` +
      `<b>From:</b> ${escapeHtml(fromAddress)}\n` +
      `<b>Subject:</b> ${escapeHtml(session.subject)}\n\n` +
      `<b>Message:</b>\n<pre>${escapeHtml(preview)}</pre>\n\n` +
      `A standard company signature will be appended.`,
    reply_markup: {
      inline_keyboard: [
        [{ text: "✅ Confirm send", callback_data: "em:confirm" }],
        [
          { text: "✏️ Edit subject", callback_data: "em:edit:s" },
          { text: "✏️ Edit body", callback_data: "em:edit:b" },
        ],
        [{ text: "❌ Cancel", callback_data: "em:cancel" }],
      ],
    },
  };
}

export async function captureSubject(chatId: number, text: string): Promise<ActionResult> {
  const trimmed = text.trim();
  if (!trimmed) {
    return { text: "Subject can't be empty. Type the subject line, or tap Cancel.", reply_markup: { inline_keyboard: [[{ text: "❌ Cancel", callback_data: "em:cancel" }]] } };
  }
  if (trimmed.length > 250) {
    return { text: "Subject is too long (max 250 chars). Try a shorter version." };
  }
  const session = await getSession(chatId);
  if (!session) return { text: "No active compose. Tap 📧 Emails to start." };
  await upsertSession({ ...session, chat_id: String(chatId), stage: "await_body", subject: trimmed });
  return {
    text:
      `📝 <b>Subject saved.</b>\n<code>${escapeHtml(trimmed)}</code>\n\n` +
      `<b>Step 2 of 2 — Message</b>\nNow type the email body. Plain text is fine; line breaks are kept.\n\n` +
      `The company signature is added automatically.`,
    reply_markup: { inline_keyboard: [[{ text: "❌ Cancel", callback_data: "em:cancel" }]] },
  };
}

export async function captureBody(chatId: number, text: string): Promise<ActionResult> {
  const trimmed = text.trim();
  if (!trimmed) {
    return { text: "Message body can't be empty. Type the email, or tap Cancel." };
  }
  const session = await getSession(chatId);
  if (!session || !session.contact_email || !session.subject) {
    return { text: "No active compose. Tap 📧 Emails to start." };
  }
  await upsertSession({ ...session, chat_id: String(chatId), stage: "await_confirm", body: trimmed });

  let fromAddress = "(company Gmail)";
  try {
    const prof = await getGmailProfile();
    fromAddress = prof.emailAddress;
  } catch { /* show fallback */ }

  const preview = trimmed.length > 600 ? `${trimmed.slice(0, 600)}…` : trimmed;
  return {
    text:
      `📨 <b>Ready to send — confirm</b>\n\n` +
      `<b>To:</b> ${escapeHtml(session.contact_name ?? "")} &lt;${escapeHtml(session.contact_email)}&gt;\n` +
      `<b>From:</b> ${escapeHtml(fromAddress)}\n` +
      `<b>Subject:</b> ${escapeHtml(session.subject)}\n\n` +
      `<b>Message:</b>\n<pre>${escapeHtml(preview)}</pre>\n\n` +
      `A standard company signature will be appended.`,
    reply_markup: {
      inline_keyboard: [[
        { text: "✅ Confirm send", callback_data: "em:confirm" },
        { text: "❌ Cancel", callback_data: "em:cancel" },
      ]],
    },
  };
}

function bodyToHtml(text: string): string {
  return text
    .split(/\n{2,}/)
    .map((p) => `<p style="margin:0 0 14px;">${escapeHtml(p).replace(/\n/g, "<br/>")}</p>`)
    .join("");
}

export async function confirmAndSend(chatId: number): Promise<ActionResult> {
  const session = await getSession(chatId);
  if (!session || !session.contact_email || !session.subject || !session.body) {
    return { text: "No email ready to send. Tap 📧 Emails to start again." };
  }
  const linked = await isGmailLinked();
  if (!linked) {
    await clearSession(chatId);
    return { text: "❌ The company Gmail account is not connected. Send aborted." };
  }

  const sig = await loadSignature();
  const htmlBody = `
<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.55;color:#222;max-width:640px;">
  ${bodyToHtml(session.body)}
  ${renderSignatureHtml(sig)}
</div>`.trim();
  const textBody = `${session.body}\n${renderSignatureText(sig)}`;

  let fromAddress: string | null = null;
  try {
    const prof = await getGmailProfile();
    fromAddress = prof.emailAddress;
  } catch { /* leave null; Gmail will fill */ }

  try {
    const result = await sendHtmlEmail({
      to: session.contact_email,
      subject: session.subject,
      textBody,
      htmlBody,
      fromName: sig.company_name,
      fromAddress,
    });
    await supabaseAdmin.from("outbound_email_log").insert({
      channel: "telegram",
      actor_profile_id: session.actor_profile_id,
      contact_kind: session.contact_kind,
      contact_id: session.contact_id,
      recipient_name: session.contact_name,
      recipient_email: session.contact_email,
      from_address: fromAddress,
      subject: session.subject,
      body_preview: session.body.slice(0, 500),
      gmail_message_id: result.id,
      gmail_thread_id: result.threadId,
      status: "sent",
    } as never);
    await clearSession(chatId);
    return {
      text:
        `✅ <b>Email sent</b>\n` +
        `To: ${escapeHtml(session.contact_name ?? "")} &lt;${escapeHtml(session.contact_email)}&gt;\n` +
        `Subject: ${escapeHtml(session.subject)}\n` +
        `Gmail id: <code>${escapeHtml(result.id)}</code>`,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await supabaseAdmin.from("outbound_email_log").insert({
      channel: "telegram",
      actor_profile_id: session.actor_profile_id,
      contact_kind: session.contact_kind,
      contact_id: session.contact_id,
      recipient_name: session.contact_name,
      recipient_email: session.contact_email,
      from_address: fromAddress,
      subject: session.subject,
      body_preview: session.body.slice(0, 500),
      status: "failed",
      error_message: msg.slice(0, 1000),
    } as never);
    await clearSession(chatId);
    return { text: `❌ <b>Send failed</b>\n${escapeHtml(msg.slice(0, 400))}` };
  }
}

export async function cancelCompose(chatId: number): Promise<ActionResult> {
  await clearSession(chatId);
  return { text: "🛑 Compose cancelled. Tap 📧 Emails to start a new one." };
}