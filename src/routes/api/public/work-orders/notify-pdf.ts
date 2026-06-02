import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { buildWorkOrderPdf } from "@/lib/workOrderPdf.server";
import { sendTelegramDocument } from "@/services/telegramSend.server";

type Body = { work_order_id?: string; kind?: "created" | "closed" };

async function getRecipientChatIds(): Promise<string[]> {
  // Send to all bosses + dispatchers who have telegram linked and are opted in.
  const { data: roleRows } = await supabaseAdmin
    .from("user_roles")
    .select("user_id, role")
    .in("role", ["boss", "dispatcher"]);
  const userIds = Array.from(new Set((roleRows ?? []).map((r: any) => r.user_id)));
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
  const chatIds: string[] = [];
  for (const c of contacts ?? []) {
    const pid = (c as any).profile_id as string;
    const chat = (c as any).telegram_chat_id as string | null;
    if (chat && !optedOut.has(pid)) chatIds.push(chat);
  }
  return Array.from(new Set(chatIds));
}

export const Route = createFileRoute("/api/public/work-orders/notify-pdf")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const auth = request.headers.get("authorization") ?? "";
        const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
        const { data: tokenRow } = await supabaseAdmin
          .from("internal_settings")
          .select("value")
          .eq("key", "telegram_flush_token")
          .maybeSingle();
        const expected = (tokenRow as any)?.value as string | undefined;
        if (!expected || token !== expected) {
          return new Response("Unauthorized", { status: 401 });
        }

        let body: Body = {};
        try {
          body = (await request.json()) as Body;
        } catch {
          return Response.json({ error: "invalid_json" }, { status: 400 });
        }
        const workOrderId = body.work_order_id;
        const kind = body.kind ?? "created";
        if (!workOrderId) {
          return Response.json({ error: "missing_work_order_id" }, { status: 400 });
        }

        const pdf = await buildWorkOrderPdf(workOrderId);
        if (!pdf) {
          return Response.json({ error: "work_order_not_found" }, { status: 404 });
        }

        const chatIds = await getRecipientChatIds();
        if (chatIds.length === 0) {
          return Response.json({ ok: true, sent: 0, reason: "no_recipients" });
        }

        const headline =
          kind === "closed"
            ? `✅ Work order <b>${pdf.orderNo}</b> closed`
            : `🆕 New work order <b>${pdf.orderNo}</b>`;
        const caption = `${headline}\n${pdf.summary}`;

        let sent = 0;
        const errors: string[] = [];
        for (const chatId of chatIds) {
          const res = await sendTelegramDocument({
            chatId,
            filename: pdf.filename,
            content: pdf.bytes,
            mimeType: "application/pdf",
            caption,
            parseMode: "HTML",
          });
          if (res.ok) sent += 1;
          else errors.push(`${chatId}: ${res.error}`);
        }

        return Response.json({ ok: true, sent, errors });
      },
    },
  },
});
