/**
 * Server-only: send a Telegram notification to bosses + dispatchers when a
 * new intake record is captured. Includes labeled extracted fields and
 * attaches the source PDF when available. Idempotent — re-runs for the
 * same intake row are skipped via a stamp in raw_payload_json.
 */

import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  sendTelegramDocument,
  sendTelegramMessage,
} from "@/services/telegramSend.server";
import {
  collectAttachmentRefs,
  getAttachmentData,
  getMessageFull,
} from "./gmail.server";

function esc(s: string | null | undefined): string {
  if (s == null) return "";
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

async function getRecipientChatIds(): Promise<string[]> {
  const { data: roleRows } = await supabaseAdmin
    .from("user_roles")
    .select("user_id, role")
    .in("role", ["boss", "dispatcher"]);
  const userIds = Array.from(
    new Set((roleRows ?? []).map((r: any) => r.user_id as string)),
  );
  if (!userIds.length) return [];

  const [{ data: contacts }, { data: prefs }] = await Promise.all([
    supabaseAdmin
      .from("user_contact_profiles")
      .select("profile_id, telegram_chat_id")
      .in("profile_id", userIds),
    supabaseAdmin
      .from("notification_preferences")
      .select("profile_id, telegram_enabled")
      .in("profile_id", userIds),
  ]);

  const optedOut = new Set<string>();
  for (const p of prefs ?? []) {
    if ((p as any).telegram_enabled === false) optedOut.add((p as any).profile_id);
  }
  const chats: string[] = [];
  for (const c of contacts ?? []) {
    const pid = (c as any).profile_id as string;
    const chat = (c as any).telegram_chat_id as string | null;
    if (chat && !optedOut.has(pid)) chats.push(chat);
  }
  return Array.from(new Set(chats));
}

function base64ToBytes(b64: string): Uint8Array {
  // gmail returns standard base64 here (we already normalized from base64url)
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export async function sendIntakeNotification(intakeId: string): Promise<void> {
  const { data: row } = await supabaseAdmin
    .from("intake_records")
    .select(
      "id, source_type, source_reference, source_sender, source_subject, received_at, extracted_fields_json, suggested_categorization_json, parse_confidence, missing_fields_json, raw_payload_json",
    )
    .eq("id", intakeId)
    .maybeSingle();
  if (!row) return;

  const payload = ((row as any).raw_payload_json ?? {}) as Record<string, any>;
  if (payload.telegram_notified_at) return; // idempotency

  const ef = ((row as any).extracted_fields_json ?? {}) as Record<string, any>;
  const cat = ((row as any).suggested_categorization_json ?? {}) as Record<string, any>;
  const missing = (((row as any).missing_fields_json ?? []) as unknown[]).map(String);
  const total = Number(payload.work_orders_total ?? 1);
  const idx = payload.work_order_index;
  const conf =
    typeof (row as any).parse_confidence === "number"
      ? Math.round(((row as any).parse_confidence as number) * 100)
      : null;

  const lines: string[] = [];
  lines.push(`🆕 <b>New Intake · Work Order Candidate</b>`);
  if (total > 1 && idx) {
    lines.push(`<i>Job ${idx} of ${total} extracted from this source</i>`);
  }
  lines.push("");
  if ((row as any).source_sender)
    lines.push(`<b>From:</b> ${esc((row as any).source_sender)}`);
  if ((row as any).source_subject)
    lines.push(`<b>Subject:</b> ${esc((row as any).source_subject)}`);
  if (ef.client_name) lines.push(`<b>Client / Agency:</b> ${esc(ef.client_name)}`);
  if (ef.contact_name || ef.contact_phone) {
    lines.push(
      `<b>Tenant:</b> ${esc(ef.contact_name ?? "")}` +
        (ef.contact_phone ? ` · ${esc(ef.contact_phone)}` : ""),
    );
  }
  const addr = [ef.address_line_1, ef.city, ef.postcode]
    .filter(Boolean)
    .map(String)
    .join(", ");
  if (addr) lines.push(`📍 <b>Site:</b> ${esc(addr)}`);
  if (ef.order_no) lines.push(`<b>Client ref:</b> ${esc(ef.order_no)}`);
  if (ef.job_summary) lines.push(`<b>Issue:</b> ${esc(ef.job_summary)}`);
  if (cat.priority_level)
    lines.push(`<b>Priority:</b> ${esc(String(cat.priority_level))}`);
  if (total > 1) lines.push(`<b>Jobs in source:</b> ${total}`);
  if (conf != null) {
    const reviewTag = missing.length > 0 ? " · review needed" : "";
    lines.push(
      `<b>Confidence:</b> ${conf}%${reviewTag}` +
        (missing.length
          ? `\n<b>Missing:</b> ${esc(missing.slice(0, 5).join(", "))}`
          : ""),
    );
  }
  if ((row as any).received_at)
    lines.push(
      `<b>Received:</b> ${new Date((row as any).received_at as string)
        .toISOString()
        .replace("T", " ")
        .slice(0, 16)} UTC`,
    );
  lines.push("");
  lines.push(`<i>Open Intake Queue in OCS · /admin/intake</i>`);
  const text = lines.join("\n");

  const chatIds = await getRecipientChatIds();
  if (!chatIds.length) {
    await stampNotified(intakeId, payload);
    return;
  }

  // Best-effort: attach the first PDF source attachment if available.
  let pdf: { filename: string; bytes: Uint8Array } | null = null;
  const attachments = (payload.source_attachments ?? []) as Array<{
    filename: string;
    mimeType: string;
  }>;
  const gmailMsgId = payload.gmail_message_id as string | undefined;
  if (gmailMsgId && attachments.length) {
    const pdfRef = attachments.find(
      (a) => /pdf/i.test(a.mimeType ?? "") || /\.pdf$/i.test(a.filename ?? ""),
    );
    if (pdfRef) {
      try {
        const full = await getMessageFull(gmailMsgId);
        const refs = collectAttachmentRefs(full.payload);
        const ref = refs.find((r) => r.filename === pdfRef.filename);
        if (ref) {
          const data = await getAttachmentData(gmailMsgId, ref.attachmentId);
          if (data) pdf = { filename: ref.filename, bytes: base64ToBytes(data) };
        }
      } catch {
        /* fall back to text-only */
      }
    }
  }

  for (const chatId of chatIds) {
    if (pdf) {
      const r = await sendTelegramDocument({
        chatId,
        filename: pdf.filename,
        content: pdf.bytes,
        mimeType: "application/pdf",
        caption: text,
        parseMode: "HTML",
      });
      if (!r.ok) {
        await sendTelegramMessage({ chatId, text, parseMode: "HTML" });
      }
    } else {
      await sendTelegramMessage({ chatId, text, parseMode: "HTML" });
    }
  }

  await stampNotified(intakeId, payload);

  // Best-effort: if the tenant phone (or sender phone) isn't on any client
  // or contact yet, queue a follow-up so the bot can prompt the boss to file.
  try {
    const { maybeCreateUnknownPhoneFollowup } = await import("@/lib/telegramConsole.server");
    const phone = (ef.contact_phone ?? null) as string | null;
    await maybeCreateUnknownPhoneFollowup({
      phone,
      name: (ef.contact_name ?? ef.client_name ?? null) as string | null,
      sourceReference: (row as any).source_reference ?? (row as any).source_subject ?? null,
      preview: (ef.job_summary ?? null) as string | null,
      recordId: intakeId,
    });
  } catch {
    /* non-fatal */
  }
}

async function stampNotified(
  intakeId: string,
  payload: Record<string, any>,
): Promise<void> {
  await supabaseAdmin
    .from("intake_records")
    .update({
      raw_payload_json: {
        ...payload,
        telegram_notified_at: new Date().toISOString(),
      } as never,
    } as never)
    .eq("id", intakeId);
}