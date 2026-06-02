import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export interface EmailTemplate {
  id: string;
  slug: string;
  name: string;
  subject: string;
  body: string;
  sort_order: number;
  is_active: boolean;
  updated_at: string;
}

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

export const listEmailTemplates = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const { data, error } = await supabase
      .from("email_templates")
      .select("id, slug, name, subject, body, sort_order, is_active, updated_at")
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true });
    if (error) throw new Error(error.message);
    return { templates: (data ?? []) as EmailTemplate[] };
  });

const templateInput = z.object({
  id: z.string().uuid().optional(),
  slug: z.string().min(1).max(64).regex(/^[a-z0-9_]+$/),
  name: z.string().min(1).max(120),
  subject: z.string().min(1).max(250),
  body: z.string().min(1).max(8000),
  sort_order: z.number().int().min(0).max(10000).default(100),
  is_active: z.boolean().default(true),
});

export const upsertEmailTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: z.input<typeof templateInput>) => templateInput.parse(data))
  .handler(async ({ data, context }) => {
    await assertBoss(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const row = {
      slug: data.slug,
      name: data.name,
      subject: data.subject,
      body: data.body,
      sort_order: data.sort_order,
      is_active: data.is_active,
      updated_by: context.userId,
    };
    if (data.id) {
      const { error } = await supabaseAdmin
        .from("email_templates")
        .update(row as never)
        .eq("id", data.id);
      if (error) throw new Error(error.message);
      return { ok: true, id: data.id };
    }
    const { data: ins, error } = await supabaseAdmin
      .from("email_templates")
      .insert({ ...row, created_by: context.userId } as never)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { ok: true, id: (ins as { id: string }).id };
  });

export const deleteEmailTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { id: string }) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    await assertBoss(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("email_templates")
      .delete()
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });