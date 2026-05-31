import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { flushPendingTelegram } from "./telegramDispatch.server";

async function assertDispatcher(supabase: any, userId: string) {
  const { data, error } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "dispatcher")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Only dispatchers can flush Telegram dispatches");
}

export const flushTelegramNotifications = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ limit: z.number().int().min(1).max(100).optional() }).parse(input ?? {}),
  )
  .handler(async ({ data, context }) => {
    await assertDispatcher(context.supabase, context.userId);
    return flushPendingTelegram(data.limit ?? 25);
  });