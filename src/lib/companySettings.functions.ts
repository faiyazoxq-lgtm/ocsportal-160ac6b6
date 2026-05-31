import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

async function assertBoss(supabase: any, userId: string) {
  const { data, error } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "boss")
    .maybeSingle();
  if (error) throw new Error("Failed to verify boss role");
  if (!data) throw new Error("Forbidden: boss role required");
}

export const updateCompanyWorkEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { work_email: string | null }) =>
    z
      .object({
        work_email: z
          .union([z.string().email().max(200), z.literal(""), z.null()])
          .transform((v) => (v === "" ? null : v)),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    await assertBoss(context.supabase, context.userId);

    const { data: existing } = await supabaseAdmin
      .from("company_settings")
      .select("id")
      .eq("singleton", true)
      .maybeSingle();

    if (existing) {
      const { error } = await supabaseAdmin
        .from("company_settings")
        .update({
          work_email: data.work_email,
          updated_by: context.userId,
          updated_at: new Date().toISOString(),
        } as never)
        .eq("id", existing.id);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await supabaseAdmin
        .from("company_settings")
        .insert({
          work_email: data.work_email,
          updated_by: context.userId,
        } as never);
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });