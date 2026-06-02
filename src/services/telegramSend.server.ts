// Server-only Telegram sender that goes through the Lovable connector gateway.

const GATEWAY_URL = "https://connector-gateway.lovable.dev/telegram";

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export async function sendTelegramMessage(params: {
  chatId: string;
  text: string;
  parseMode?: "HTML" | "MarkdownV2";
}): Promise<{ ok: true; messageId: number } | { ok: false; error: string }> {
  const lovableKey = process.env.LOVABLE_API_KEY;
  const telegramKey = process.env.TELEGRAM_API_KEY;
  if (!lovableKey) return { ok: false, error: "LOVABLE_API_KEY is not configured" };
  if (!telegramKey) return { ok: false, error: "TELEGRAM_API_KEY is not configured" };

  try {
    const res = await fetch(`${GATEWAY_URL}/sendMessage`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${lovableKey}`,
        "X-Connection-Api-Key": telegramKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        chat_id: params.chatId,
        text: params.text,
        parse_mode: params.parseMode ?? "HTML",
        disable_web_page_preview: true,
      }),
    });
    const data = (await res.json().catch(() => ({}))) as {
      ok?: boolean;
      result?: { message_id?: number };
      description?: string;
    };
    if (!res.ok || !data.ok) {
      return { ok: false, error: data.description ?? `HTTP ${res.status}` };
    }
    return { ok: true, messageId: data.result?.message_id ?? 0 };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Unknown error" };
  }
}

export async function editTelegramMessageText(params: {
  chatId: string;
  messageId: number;
  text: string;
  parseMode?: "HTML" | "MarkdownV2";
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const lovableKey = process.env.LOVABLE_API_KEY;
  const telegramKey = process.env.TELEGRAM_API_KEY;
  if (!lovableKey) return { ok: false, error: "LOVABLE_API_KEY is not configured" };
  if (!telegramKey) return { ok: false, error: "TELEGRAM_API_KEY is not configured" };
  try {
    const res = await fetch(`${GATEWAY_URL}/editMessageText`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${lovableKey}`,
        "X-Connection-Api-Key": telegramKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        chat_id: params.chatId,
        message_id: params.messageId,
        text: params.text,
        parse_mode: params.parseMode ?? "HTML",
        disable_web_page_preview: true,
      }),
    });
    const data = (await res.json().catch(() => ({}))) as {
      ok?: boolean;
      description?: string;
    };
    if (!res.ok || !data.ok) {
      return { ok: false, error: data.description ?? `HTTP ${res.status}` };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Unknown error" };
  }
}

export async function editTelegramMessageCaption(params: {
  chatId: string;
  messageId: number;
  caption: string;
  parseMode?: "HTML" | "MarkdownV2";
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const lovableKey = process.env.LOVABLE_API_KEY;
  const telegramKey = process.env.TELEGRAM_API_KEY;
  if (!lovableKey) return { ok: false, error: "LOVABLE_API_KEY is not configured" };
  if (!telegramKey) return { ok: false, error: "TELEGRAM_API_KEY is not configured" };
  try {
    const res = await fetch(`${GATEWAY_URL}/editMessageCaption`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${lovableKey}`,
        "X-Connection-Api-Key": telegramKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        chat_id: params.chatId,
        message_id: params.messageId,
        caption: params.caption,
        parse_mode: params.parseMode ?? "HTML",
      }),
    });
    const data = (await res.json().catch(() => ({}))) as {
      ok?: boolean;
      description?: string;
    };
    if (!res.ok || !data.ok) {
      return { ok: false, error: data.description ?? `HTTP ${res.status}` };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Unknown error" };
  }
}

export async function sendTelegramDocument(params: {
  chatId: string;
  filename: string;
  content: string;
  mimeType?: string;
  caption?: string;
  parseMode?: "HTML" | "MarkdownV2";
}): Promise<{ ok: true; messageId: number } | { ok: false; error: string }> {
  const lovableKey = process.env.LOVABLE_API_KEY;
  const telegramKey = process.env.TELEGRAM_API_KEY;
  if (!lovableKey) return { ok: false, error: "LOVABLE_API_KEY is not configured" };
  if (!telegramKey) return { ok: false, error: "TELEGRAM_API_KEY is not configured" };
  try {
    const fd = new FormData();
    fd.append("chat_id", params.chatId);
    if (params.caption) {
      fd.append("caption", params.caption);
      fd.append("parse_mode", params.parseMode ?? "HTML");
    }
    const blob = new Blob([params.content], {
      type: params.mimeType ?? "text/plain; charset=utf-8",
    });
    fd.append("document", blob, params.filename);
    const res = await fetch(`${GATEWAY_URL}/sendDocument`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${lovableKey}`,
        "X-Connection-Api-Key": telegramKey,
      },
      body: fd,
    });
    const data = (await res.json().catch(() => ({}))) as {
      ok?: boolean;
      result?: { message_id?: number };
      description?: string;
    };
    if (!res.ok || !data.ok) {
      return { ok: false, error: data.description ?? `HTTP ${res.status}` };
    }
    return { ok: true, messageId: data.result?.message_id ?? 0 };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Unknown error" };
  }
}

export async function resolveTelegramChatId(
  username: string,
): Promise<{ ok: true; chatId: string } | { ok: false; error: string }> {
  // Telegram does NOT expose username->chat_id directly. The user must have
  // started the bot first; we then read updates to find their chat.
  const lovableKey = process.env.LOVABLE_API_KEY;
  const telegramKey = process.env.TELEGRAM_API_KEY;
  if (!lovableKey || !telegramKey) return { ok: false, error: "Telegram not configured" };

  const cleaned = username.replace(/^@/, "").toLowerCase();
  try {
    const res = await fetch(`${GATEWAY_URL}/getUpdates`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${lovableKey}`,
        "X-Connection-Api-Key": telegramKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ limit: 100, allowed_updates: ["message"] }),
    });
    const data = (await res.json()) as {
      ok?: boolean;
      result?: Array<{
        message?: {
          chat?: { id?: number; username?: string; type?: string };
          from?: { username?: string };
        };
      }>;
      description?: string;
    };
    if (!data.ok) return { ok: false, error: data.description ?? "getUpdates failed" };
    for (const upd of data.result ?? []) {
      const chat = upd.message?.chat;
      const fromUsername = upd.message?.from?.username?.toLowerCase();
      const chatUsername = chat?.username?.toLowerCase();
      if (
        chat?.id &&
        chat.type === "private" &&
        (fromUsername === cleaned || chatUsername === cleaned)
      ) {
        return { ok: true, chatId: String(chat.id) };
      }
    }
    return {
      ok: false,
      error:
        "Could not find a recent message from @" +
        cleaned +
        ". Please send /start to the bot first, then try again.",
    };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Unknown error" };
  }
}

export function formatDmNotification(args: {
  senderName: string;
  preview: string;
  threadDeepLink?: string;
}): string {
  const previewLine = escapeHtml(args.preview.slice(0, 240));
  const link = args.threadDeepLink
    ? `\n\n<a href="${escapeHtml(args.threadDeepLink)}">Open in OCS</a>`
    : "";
  return `<b>${escapeHtml(args.senderName)}</b> sent you a new message:\n\n${previewLine}${link}`;
}