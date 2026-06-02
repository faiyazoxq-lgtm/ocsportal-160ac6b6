import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { performGmailSync } from "@/lib/gmailSync.server";

export const Route = createFileRoute("/api/public/gmail/auto-sync")({
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
          .eq("key", "gmail_sync_token")
          .maybeSingle();

        if (error || !data?.value) {
          return new Response("Server token missing", { status: 500 });
        }

        const expected = String(data.value);
        if (provided.length !== expected.length || provided !== expected) {
          return new Response("Unauthorized", { status: 401 });
        }

        try {
          const result = await performGmailSync();
          return Response.json({ ok: true, ...result });
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          return Response.json({ ok: false, error: msg }, { status: 500 });
        }
      },
    },
  },
});