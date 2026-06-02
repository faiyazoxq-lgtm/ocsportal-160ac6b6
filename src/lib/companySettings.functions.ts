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

async function ensureSingletonId(): Promise<string> {
  const { data: existing } = await supabaseAdmin
    .from("company_settings")
    .select("id")
    .eq("singleton", true)
    .maybeSingle();
  if (existing) return (existing as { id: string }).id;
  const { data: inserted, error } = await supabaseAdmin
    .from("company_settings")
    .insert({} as never)
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return (inserted as { id: string }).id;
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
    const id = await ensureSingletonId();
    const { error } = await supabaseAdmin
      .from("company_settings")
      .update({
        work_email: data.work_email,
        updated_by: context.userId,
        updated_at: new Date().toISOString(),
      } as never)
      .eq("id", id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const updateIntakeSniffingEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { intake_sniffing_email: string | null }) =>
    z
      .object({
        intake_sniffing_email: z
          .union([z.string().email().max(200), z.literal(""), z.null()])
          .transform((v) => (v === "" ? null : v)),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    await assertBoss(context.supabase, context.userId);
    const id = await ensureSingletonId();
    const { error } = await supabaseAdmin
      .from("company_settings")
      .update({
        intake_sniffing_email: data.intake_sniffing_email,
        updated_by: context.userId,
        updated_at: new Date().toISOString(),
      } as never)
      .eq("id", id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const updateStatusColors = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { status_colors: Record<string, string> }) =>
    z
      .object({
        status_colors: z.record(
          z.string().min(1).max(64),
          z.string().regex(/^#[0-9a-fA-F]{6}$/),
        ),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    await assertBoss(context.supabase, context.userId);
    const id = await ensureSingletonId();
    const { error } = await supabaseAdmin
      .from("company_settings")
      .update({
        status_colors: data.status_colors,
        updated_by: context.userId,
        updated_at: new Date().toISOString(),
      } as never)
      .eq("id", id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

const engineerPermissionsSchema = z.record(
  z.string().min(1).max(64),
  z.record(z.string().min(1).max(64), z.boolean()),
);

export const updateEngineerPermissions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { engineer_permissions: Record<string, Record<string, boolean>> }) =>
    z.object({ engineer_permissions: engineerPermissionsSchema }).parse(data),
  )
  .handler(async ({ data, context }) => {
    await assertBoss(context.supabase, context.userId);
    const id = await ensureSingletonId();
    const { error } = await supabaseAdmin
      .from("company_settings")
      .update({
        engineer_permissions: data.engineer_permissions,
        updated_by: context.userId,
        updated_at: new Date().toISOString(),
      } as never)
      .eq("id", id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const updateGmailProcessedLabel = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { gmail_processed_label: string | null }) =>
    z
      .object({
        gmail_processed_label: z
          .union([z.string().min(1).max(120), z.literal(""), z.null()])
          .transform((v) => (v === "" || v === null ? "OCS / Imported Work Orders" : v)),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    await assertBoss(context.supabase, context.userId);
    const id = await ensureSingletonId();
    const { error } = await supabaseAdmin
      .from("company_settings")
      .update({
        gmail_processed_label: data.gmail_processed_label,
        updated_by: context.userId,
        updated_at: new Date().toISOString(),
      } as never)
      .eq("id", id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });