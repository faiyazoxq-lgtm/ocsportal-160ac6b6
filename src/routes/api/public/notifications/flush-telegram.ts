import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { flushPendingTelegram } from "@/lib/telegramDispatch.server";

export const Route = createFileRoute("/api/public/notifications/flush-telegram")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const auth = request.headers.get("authorization") ?? "";
        const provided = auth.replace(/^Bearer\s+/i, "").trim();
        if (!provided) {
          return new Response("Unauthorized", { status: 401 });
        }

        const { data, error } = await supabaseAdmin
          .from("internal_settings")
          .select("value")
          .eq("key", "telegram_flush_token")
          .maybeSingle();

        if (error || !data?.value) {
          return new Response("Server token missing", { status: 500 });
        }

        // Constant-time-ish compare
        const expected = String(data.value);
        if (
          provided.length !== expected.length ||
          provided !== expected
        ) {
          return new Response("Unauthorized", { status: 401 });
        }

        try {
          const result = await flushPendingTelegram(50);
          return Response.json({ ok: true, ...result });
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          return Response.json({ ok: false, error: msg }, { status: 500 });
        }
      },
    },
  },
});
