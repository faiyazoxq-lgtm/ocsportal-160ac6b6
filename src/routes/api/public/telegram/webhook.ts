import { createFileRoute } from "@tanstack/react-router";
import { createHash, timingSafeEqual } from "crypto";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  actions,
  mainReplyKeyboard,
  tabInlineKeyboard,
  resolveFollowup,
  searchWorkOrder,
  searchEngineer,
  searchContact,
  escapeHtml,
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
async function answerCallback(callbackQueryId: string, text?: string) {
  await tg("answerCallbackQuery", { callback_query_id: callbackQueryId, ...(text ? { text } : {}) });
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

          const auth = await authoriseChat(chatId);
          if (!auth) {
            await sendMessage(
              chatId,
              "🔒 This bot is restricted to linked Boss/Dispatcher accounts.\nAsk an admin to link your Telegram in your profile.",
            );
            return Response.json({ ok: true });
          }

          // Tab labels
          if (TAB_LABELS[text]) {
            const tab = TAB_LABELS[text];
            await sendMessage(chatId, `<b>${escapeHtml(text)}</b> — choose an action:`, { reply_markup: tabInlineKeyboard(tab) });
            return Response.json({ ok: true });
          }
          if (text === "📧 Emails") {
            const res = await emailsTabAction(0);
            await sendMessage(chatId, res.text, { reply_markup: res.reply_markup });
            return Response.json({ ok: true });
          }

          if (text === "/start" || text === "ℹ️ Menu" || text === "/menu") {
            await sendMessage(chatId, menuText(), { reply_markup: mainReplyKeyboard() });
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

          await sendMessage(chatId, "Tap a tab below, or type /menu.", { reply_markup: mainReplyKeyboard() });
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