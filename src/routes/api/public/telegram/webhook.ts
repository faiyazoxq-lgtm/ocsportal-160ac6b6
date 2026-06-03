import { createFileRoute } from "@tanstack/react-router";
import { createHash, timingSafeEqual } from "crypto";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  actions,
  mainReplyKeyboard,
  tabInlineKeyboard,
  stripTabBadge,
  resolveFollowup,
  searchWorkOrder,
  searchEngineer,
  searchContact,
  escapeHtml,
  woAction,
  type WoMessage,
  type InlineKeyboard,
  type ReplyKeyboard,
} from "@/lib/telegramConsole.server";
import {
  emailsTabAction,
  startCompose,
  captureSubject,
  captureBody,
  confirmAndSend,
  cancelCompose,
  getSession,
  showTemplatePicker,
  startCustomCompose,
  applyTemplate,
  editSubject,
  editBody,
} from "@/lib/telegramEmail.server";

const GATEWAY_URL = "https://connector-gateway.lovable.dev/telegram";

function deriveSecret(apiKey: string): string {
  return createHash("sha256").update(`telegram-webhook:${apiKey}`).digest("base64url");
}
function safeEq(a: string, b: string): boolean {
  const A = Buffer.from(a);
  const B = Buffer.from(b);
  return A.length === B.length && timingSafeEqual(A, B);
}

async function tg(method: string, body: Record<string, unknown>) {
  const lovableKey = process.env.LOVABLE_API_KEY;
  const telegramKey = process.env.TELEGRAM_API_KEY;
  if (!lovableKey || !telegramKey) return;
  await fetch(`${GATEWAY_URL}/${method}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${lovableKey}`,
      "X-Connection-Api-Key": telegramKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  }).catch(() => {});
}

async function sendMessage(chatId: number, text: string, opts: { reply_markup?: InlineKeyboard | ReplyKeyboard } = {}) {
  await tg("sendMessage", {
    chat_id: chatId,
    text,
    parse_mode: "HTML",
    disable_web_page_preview: true,
    ...(opts.reply_markup ? { reply_markup: opts.reply_markup } : {}),
  });
}

/** Send a message that removes the persistent reply keyboard, with an inline
 * "Show menu" button so the user can bring it back without typing. */
async function sendHideMenu(chatId: number) {
  await tg("sendMessage", {
    chat_id: chatId,
    text: "🙈 Menu hidden. Tap below or send <code>/menu</code> to show it again.",
    parse_mode: "HTML",
    reply_markup: {
      remove_keyboard: true,
    },
  });
  await tg("sendMessage", {
    chat_id: chatId,
    text: "—",
    reply_markup: { inline_keyboard: [[{ text: "👁️ Show menu", callback_data: "ui:show_menu" }]] },
  });
}
async function answerCallback(callbackQueryId: string, text?: string) {
  await tg("answerCallbackQuery", { callback_query_id: callbackQueryId, ...(text ? { text } : {}) });
}

/** Send a generated PDF (bytes) as a Telegram document via multipart upload. */
async function sendPdfDocument(chatId: number, bytes: Uint8Array, filename: string, caption?: string) {
  const lovableKey = process.env.LOVABLE_API_KEY;
  const telegramKey = process.env.TELEGRAM_API_KEY;
  if (!lovableKey || !telegramKey) return;
  const fd = new FormData();
  fd.append("chat_id", String(chatId));
  if (caption) {
    fd.append("caption", caption.slice(0, 1000));
    fd.append("parse_mode", "HTML");
  }
  const buf = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(buf).set(bytes);
  fd.append("document", new Blob([buf], { type: "application/pdf" }), filename);
  await fetch(`${GATEWAY_URL}/sendDocument`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${lovableKey}`,
      "X-Connection-Api-Key": telegramKey,
    },
    body: fd,
  }).catch(() => {});
}

/** Ask Telegram to fetch a remote URL and send it as a document. */
async function sendDocumentByUrl(chatId: number, url: string, caption?: string) {
  await tg("sendDocument", {
    chat_id: chatId,
    document: url,
    ...(caption ? { caption: caption.slice(0, 1000), parse_mode: "HTML" } : {}),
  });
}

async function deliverWoMessage(chatId: number, m: WoMessage) {
  if (m.kind === "text") {
    await sendMessage(chatId, m.text, { reply_markup: m.reply_markup });
  } else if (m.kind === "pdf") {
    await sendPdfDocument(chatId, m.bytes, m.filename, m.caption);
  } else if (m.kind === "doc_url") {
    await sendDocumentByUrl(chatId, m.url, m.caption);
  }
}

async function authoriseChat(chatId: number): Promise<{ profileId: string; role: "boss" | "dispatcher" } | null> {
  const { data: cp } = await supabaseAdmin
    .from("user_contact_profiles")
    .select("profile_id")
    .eq("telegram_chat_id", String(chatId))
    .maybeSingle();
  if (!cp?.profile_id) return null;
  const { data: roles } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", cp.profile_id);
  const roleSet = new Set((roles ?? []).map((r) => r.role as string));
  if (roleSet.has("boss")) return { profileId: cp.profile_id, role: "boss" };
  if (roleSet.has("dispatcher")) return { profileId: cp.profile_id, role: "dispatcher" };
  return null;
}

const TAB_LABELS: Record<string, "intake" | "dispatch" | "liveops" | "completion" | "finance" | "lookup" | "followups"> = {
  "📥 Intake": "intake",
  "🗓️ Dispatch": "dispatch",
  "🛠️ Live ops": "liveops",
  "✅ Completion": "completion",
  "💷 Finance": "finance",
  "🔎 Lookup": "lookup",
  "📌 Follow-ups": "followups",
};

function menuText(): string {
  return (
    "<b>🤖 OCSBot console</b>\n" +
    "Tap a tab below to see actions.\n" +
    "Commands:\n" +
    "<code>/menu</code> — show this menu\n" +
    "<code>/hide</code> — hide the menu keyboard\n" +
    "<code>/wo &lt;text&gt;</code> — find a work order\n" +
    "<code>/eng &lt;name&gt;</code> — find an engineer\n" +
    "<code>/contact &lt;text&gt;</code> — find client or contact"
  );
}

export const Route = createFileRoute("/api/public/telegram/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const telegramKey = process.env.TELEGRAM_API_KEY;
        if (!telegramKey) return new Response("Not configured", { status: 500 });
        const expected = deriveSecret(telegramKey);
        const provided = request.headers.get("X-Telegram-Bot-Api-Secret-Token") ?? "";
        if (!safeEq(provided, expected)) return new Response("Unauthorized", { status: 401 });

        const update = await request.json().catch(() => null);
        if (!update) return Response.json({ ok: true });

        try {
          // ----- callback_query (inline button taps) -----
          if (update.callback_query) {
            const cb = update.callback_query as { id: string; data?: string; message?: { chat?: { id?: number } }; from?: { id?: number } };
            const chatId = cb.message?.chat?.id;
            const data = cb.data ?? "";
            if (!chatId) {
              await answerCallback(cb.id);
              return Response.json({ ok: true });
            }
            const auth = await authoriseChat(chatId);
            if (!auth) {
              await answerCallback(cb.id, "Not authorised");
              await sendMessage(chatId, "🔒 This bot is restricted to linked Boss/Dispatcher accounts.");
              return Response.json({ ok: true });
            }

            await answerCallback(cb.id);

            if (data === "ui:show_menu") {
              await sendMessage(chatId, "Menu restored.", { reply_markup: await mainReplyKeyboard() });
              return Response.json({ ok: true });
            }
            if (data === "ui:hide_menu") {
              await sendHideMenu(chatId);
              return Response.json({ ok: true });
            }
            if (data.startsWith("act:")) {
              const [, key, pageStr] = data.split(":");
              const page = Math.max(0, parseInt(pageStr ?? "0", 10) || 0);
              const handler = actions[key];
              if (!handler) {
                await sendMessage(chatId, `Unknown action: ${escapeHtml(key)}`);
                return Response.json({ ok: true });
              }
              const res = await handler(page);
              await sendMessage(chatId, res.text, { reply_markup: res.reply_markup });
            } else if (data.startsWith("wo:")) {
              const [, woActionName, woId] = data.split(":");
              if (!woId) {
                await sendMessage(chatId, "Missing work order id.");
                return Response.json({ ok: true });
              }
              const result = await woAction({ action: woActionName, id: woId, actorProfileId: auth.profileId });
              const messages = Array.isArray(result) ? result : [result];
              for (const m of messages) await deliverWoMessage(chatId, m);
            } else if (data.startsWith("fu:")) {
              const [, action, id] = data.split(":");
              if (!["client", "agency", "contact", "ignore"].includes(action)) {
                await sendMessage(chatId, "Unknown follow-up action.");
                return Response.json({ ok: true });
              }
              const res = await resolveFollowup({
                id,
                action: action as "client" | "agency" | "contact" | "ignore",
                actorProfileId: auth.profileId,
              });
              await sendMessage(chatId, res.text);
            } else if (data.startsWith("em:")) {
              const parts = data.split(":");
              const sub = parts[1];
              if (sub === "list") {
                const page = Math.max(0, parseInt(parts[2] ?? "0", 10) || 0);
                const res = await emailsTabAction(page);
                await sendMessage(chatId, res.text, { reply_markup: res.reply_markup });
              } else if (sub === "pick") {
                const kind = parts[2] === "c" ? "client" : "external_contact";
                const id = parts[3];
                const res = await startCompose({ chatId, actorProfileId: auth.profileId, kind, contactId: id });
                await sendMessage(chatId, res.text, { reply_markup: res.reply_markup });
              } else if (sub === "tpls") {
                const res = await showTemplatePicker(chatId);
                await sendMessage(chatId, res.text, { reply_markup: res.reply_markup });
              } else if (sub === "tpl") {
                const tplId = parts[2];
                const res = await applyTemplate(chatId, tplId);
                await sendMessage(chatId, res.text, { reply_markup: res.reply_markup });
              } else if (sub === "custom") {
                const res = await startCustomCompose(chatId);
                await sendMessage(chatId, res.text, { reply_markup: res.reply_markup });
              } else if (sub === "edit") {
                const which = parts[2];
                const res = which === "s" ? await editSubject(chatId) : await editBody(chatId);
                await sendMessage(chatId, res.text, { reply_markup: res.reply_markup });
              } else if (sub === "confirm") {
                const res = await confirmAndSend(chatId);
                await sendMessage(chatId, res.text);
              } else if (sub === "cancel") {
                const res = await cancelCompose(chatId);
                await sendMessage(chatId, res.text);
              } else {
                await sendMessage(chatId, "Unknown email action.");
              }
            }
            return Response.json({ ok: true });
          }

          // ----- messages -----
          const msg = update.message ?? update.edited_message;
          const chatId = msg?.chat?.id as number | undefined;
          const text: string = (msg?.text ?? "").trim();
          if (!chatId) return Response.json({ ok: true });

          // ----- Account linking (runs BEFORE the auth check) -----
          // Deep link: /start link_<token>
          const startLinkMatch = /^\/start\s+link_([A-Za-z0-9_-]{8,64})$/.exec(text);
          if (startLinkMatch) {
            const token = startLinkMatch[1];
            const { data: target } = await supabaseAdmin
              .from("user_contact_profiles")
              .select("profile_id")
              .eq("telegram_link_token", token)
              .maybeSingle();
            if (!target?.profile_id) {
              await sendMessage(
                chatId,
                "🔒 This invite link is invalid or has already been used. Ask your admin to generate a new one.",
              );
              return Response.json({ ok: true });
            }
            const tgUser = msg?.from as { username?: string } | undefined;
            const nowIso = new Date().toISOString();
            await supabaseAdmin
              .from("user_contact_profiles")
              .upsert(
                {
                  profile_id: target.profile_id,
                  telegram_chat_id: String(chatId),
                  telegram_username: tgUser?.username ?? null,
                  telegram_linked_at: nowIso,
                  telegram_link_token: null,
                  updated_at: nowIso,
                },
                { onConflict: "profile_id" },
              );
            await tg("sendMessage", {
              chat_id: chatId,
              text: "✅ <b>Linked to OCS</b>\nYou'll now receive OCS notifications here.\n\nOptional: tap the button below to share your phone number so we can keep your profile in sync.",
              parse_mode: "HTML",
              reply_markup: {
                keyboard: [[{ text: "📱 Share my phone", request_contact: true }]],
                resize_keyboard: true,
                one_time_keyboard: true,
              },
            });
            return Response.json({ ok: true });
          }

          // Phone-based linking: user shares contact card
          const contact = msg?.contact as
            | { phone_number?: string; user_id?: number }
            | undefined;
          if (contact?.phone_number) {
            // Only trust contacts shared by the sender themselves
            const senderId = (msg?.from as { id?: number } | undefined)?.id;
            if (contact.user_id && senderId && contact.user_id !== senderId) {
              await sendMessage(chatId, "Please share your <i>own</i> contact, not someone else's.");
              return Response.json({ ok: true });
            }
            let phone = contact.phone_number.trim();
            if (!phone.startsWith("+")) phone = `+${phone.replace(/^\+?/, "")}`;
            // Try exact E.164 match first, then a last-9-digit fallback for stripped country codes
            const last9 = phone.replace(/\D/g, "").slice(-9);
            const { data: byPhone } = await supabaseAdmin
              .from("user_contact_profiles")
              .select("profile_id, telegram_phone_e164")
              .or(
                `telegram_phone_e164.eq.${phone},telegram_phone_e164.like.%${last9}`,
              )
              .limit(2);
            const match = (byPhone ?? []).find(
              (r) => r.telegram_phone_e164 === phone,
            ) ?? (byPhone?.length === 1 ? byPhone[0] : null);
            if (!match?.profile_id) {
              await sendMessage(
                chatId,
                "📵 We couldn't find your number in OCS. Ask your admin to add it under Infrastructure → Telegram recipients, or use the personal invite link they sent you.",
              );
              return Response.json({ ok: true });
            }
            const tgUser = msg?.from as { username?: string } | undefined;
            const nowIso = new Date().toISOString();
            await supabaseAdmin
              .from("user_contact_profiles")
              .upsert(
                {
                  profile_id: match.profile_id,
                  telegram_chat_id: String(chatId),
                  telegram_username: tgUser?.username ?? null,
                  telegram_linked_at: nowIso,
                  telegram_link_token: null,
                  telegram_phone_e164: phone,
                  updated_at: nowIso,
                },
                { onConflict: "profile_id" },
              );
            await tg("sendMessage", {
              chat_id: chatId,
              text: "✅ <b>Linked to OCS</b>\nThanks — you're now connected. You'll receive OCS notifications here.",
              parse_mode: "HTML",
              reply_markup: { remove_keyboard: true },
            });
            return Response.json({ ok: true });
          }

          const auth = await authoriseChat(chatId);
          if (!auth) {
            // If this chat is already linked (e.g. to an engineer), don't show
            // the linking prompt again — the console is just restricted.
            const { data: existing } = await supabaseAdmin
              .from("user_contact_profiles")
              .select("profile_id")
              .eq("telegram_chat_id", String(chatId))
              .maybeSingle();
            if (existing?.profile_id) {
              await sendMessage(
                chatId,
                "✅ Your account is linked. You'll receive OCS notifications here. The interactive console is reserved for Boss/Dispatcher accounts.",
              );
              return Response.json({ ok: true });
            }
            await tg("sendMessage", {
              chat_id: chatId,
              text: "🔒 Your Telegram isn't linked to OCS yet.\n\nAsk your admin for a personal invite link, or tap the button below to share your phone number so we can match you.",
              parse_mode: "HTML",
              reply_markup: {
                keyboard: [[{ text: "📱 Share my phone", request_contact: true }]],
                resize_keyboard: true,
                one_time_keyboard: true,
              },
            });
            return Response.json({ ok: true });
          }

          // Tab labels — tolerate the live "(N)" badge appended by mainReplyKeyboard.
          const baseText = stripTabBadge(text);
          if (TAB_LABELS[baseText]) {
            const tab = TAB_LABELS[baseText];
            await sendMessage(chatId, `<b>${escapeHtml(baseText)}</b> — choose an action:`, { reply_markup: await tabInlineKeyboard(tab) });
            return Response.json({ ok: true });
          }
          if (baseText === "📧 Emails") {
            const res = await emailsTabAction(0);
            await sendMessage(chatId, res.text, { reply_markup: res.reply_markup });
            return Response.json({ ok: true });
          }

          if (text === "/start" || baseText === "ℹ️ Menu" || text === "/menu") {
            await sendMessage(chatId, menuText(), { reply_markup: await mainReplyKeyboard() });
            return Response.json({ ok: true });
          }

          if (baseText === "🙈 Hide menu" || text === "/hide") {
            await sendHideMenu(chatId);
            return Response.json({ ok: true });
          }

          // Active email compose session captures free text as subject/body.
          if (text && !text.startsWith("/")) {
            const session = await getSession(chatId);
            if (session && session.stage === "await_subject") {
              const res = await captureSubject(chatId, text);
              await sendMessage(chatId, res.text, { reply_markup: res.reply_markup });
              return Response.json({ ok: true });
            }
            if (session && session.stage === "await_body") {
              const res = await captureBody(chatId, text);
              await sendMessage(chatId, res.text, { reply_markup: res.reply_markup });
              return Response.json({ ok: true });
            }
          }

          // Slash commands with args
          if (text.startsWith("/wo ")) {
            const r = await searchWorkOrder(text.slice(4));
            await sendMessage(chatId, r.text, { reply_markup: r.reply_markup });
            return Response.json({ ok: true });
          }
          if (text.startsWith("/eng ")) {
            const r = await searchEngineer(text.slice(5));
            await sendMessage(chatId, r.text);
            return Response.json({ ok: true });
          }
          if (text.startsWith("/contact ")) {
            const r = await searchContact(text.slice(9));
            await sendMessage(chatId, r.text);
            return Response.json({ ok: true });
          }

          await sendMessage(chatId, "Tap a tab below, or type /menu.", { reply_markup: await mainReplyKeyboard() });
          return Response.json({ ok: true });
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          console.error("[telegram webhook]", msg);
          return Response.json({ ok: true, error: msg });
        }
      },
    },
  },
});