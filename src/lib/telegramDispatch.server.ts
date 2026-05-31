import { supabaseAdmin } from "@/integrations/supabase/client.server";

const GATEWAY_URL = "https://connector-gateway.lovable.dev/telegram";

type PendingRow = {
  id: string;
  title: string;
  body: string | null;
  link_path: string | null;
  severity: string;
  recipient_profile_id: string;
};

function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function formatMessage(n: PendingRow) {
  const sevTag =
    n.severity === "critical" ? "🚨 " : n.severity === "warn" ? "⚠️ " : "🔔 ";
  const parts = [`<b>${sevTag}${escapeHtml(n.title)}</b>`];
  if (n.body) parts.push(escapeHtml(n.body));
  if (n.link_path) parts.push(`<i>${escapeHtml(n.link_path)}</i>`);
  return parts.join("\n");
}

async function sendOne(chatId: string, text: string) {
  const lovableKey = process.env.LOVABLE_API_KEY;
  const telegramKey = process.env.TELEGRAM_API_KEY;
  if (!lovableKey) throw new Error("LOVABLE_API_KEY not configured");
  if (!telegramKey) throw new Error("TELEGRAM_API_KEY not configured");

  const res = await fetch(`${GATEWAY_URL}/sendMessage`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${lovableKey}`,
      "X-Connection-Api-Key": telegramKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: "HTML",
      disable_web_page_preview: true,
    }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json?.ok === false) {
    throw new Error(
      `Telegram sendMessage failed [${res.status}]: ${JSON.stringify(json).slice(0, 300)}`,
    );
  }
}

export async function flushPendingTelegram(limit = 25) {
  // Pull pending notifications (RLS-bypassing admin client; server-only)
  const { data: pending, error } = await supabaseAdmin
    .from("notifications")
    .select("id,title,body,link_path,severity,recipient_profile_id")
    .eq("telegram_delivery_status", "pending")
    .is("dismissed_at", null)
    .order("created_at", { ascending: true })
    .limit(limit);

  if (error) throw new Error(error.message);
  const rows = (pending ?? []) as PendingRow[];
  if (!rows.length) return { processed: 0, sent: 0, failed: 0, skipped: 0 };

  const recipientIds = Array.from(
    new Set(rows.map((r) => r.recipient_profile_id)),
  );

  const [{ data: contacts }, { data: prefs }] = await Promise.all([
    supabaseAdmin
      .from("user_contact_profiles")
      .select("profile_id, telegram_chat_id")
      .in("profile_id", recipientIds),
    supabaseAdmin
      .from("notification_preferences")
      .select("profile_id, telegram_enabled, muted_types")
      .in("profile_id", recipientIds),
  ]);

  const chatByProfile = new Map<string, string | null>();
  for (const c of contacts ?? []) {
    chatByProfile.set(
      (c as any).profile_id as string,
      ((c as any).telegram_chat_id ?? null) as string | null,
    );
  }
  const prefByProfile = new Map<
    string,
    { enabled: boolean }
  >();
  for (const p of prefs ?? []) {
    prefByProfile.set((p as any).profile_id as string, {
      enabled: (p as any).telegram_enabled !== false,
    });
  }

  let sent = 0;
  let failed = 0;
  let skipped = 0;

  for (const n of rows) {
    const chatId = chatByProfile.get(n.recipient_profile_id);
    const pref = prefByProfile.get(n.recipient_profile_id);
    const optedIn = pref ? pref.enabled : true;

    if (!chatId || !optedIn) {
      const { error: uErr } = await supabaseAdmin
        .from("notifications")
        .update({
          telegram_delivery_status: "skipped",
          telegram_error: !chatId ? "no_chat_id" : "opted_out",
        })
        .eq("id", n.id)
        .eq("telegram_delivery_status", "pending");
      if (!uErr) skipped++;
      continue;
    }

    try {
      await sendOne(chatId, formatMessage(n));
      const { error: uErr } = await supabaseAdmin
        .from("notifications")
        .update({
          telegram_delivery_status: "sent",
          telegram_sent_at: new Date().toISOString(),
          telegram_error: null,
        })
        .eq("id", n.id)
        .eq("telegram_delivery_status", "pending");
      if (!uErr) sent++;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      await supabaseAdmin
        .from("notifications")
        .update({
          telegram_delivery_status: "failed",
          telegram_error: msg.slice(0, 500),
        })
        .eq("id", n.id)
        .eq("telegram_delivery_status", "pending");
      failed++;
    }
  }

  return { processed: rows.length, sent, failed, skipped };
}