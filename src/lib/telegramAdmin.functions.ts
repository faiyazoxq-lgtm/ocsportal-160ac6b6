import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { Database } from "@/integrations/supabase/types";

type NotificationType = Database["public"]["Enums"]["notification_type"];

async function assertBoss(userId: string) {
  const { data, error } = await supabaseAdmin
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (data?.role !== "boss") throw new Error("Only Boss can manage Telegram recipients");
}

export const listTelegramRecipients = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertBoss(context.userId);

    const { data: profiles, error: pErr } = await supabaseAdmin
      .from("profiles")
      .select("id, full_name, email, role, is_active")
      .eq("is_active", true)
      .order("role", { ascending: true })
      .order("full_name", { ascending: true });
    if (pErr) throw new Error(pErr.message);

    const ids = (profiles ?? []).map((p) => p.id);
    if (!ids.length) return { rows: [] };

    const [{ data: cps }, { data: prefs }] = await Promise.all([
      supabaseAdmin
        .from("user_contact_profiles")
        .select("profile_id, telegram_username, telegram_chat_id, telegram_linked_at")
        .in("profile_id", ids),
      supabaseAdmin
        .from("notification_preferences")
        .select("profile_id, in_app_enabled, telegram_enabled, muted_types")
        .in("profile_id", ids),
    ]);

    const cpById = new Map(
      (cps ?? []).map((c) => [c.profile_id as string, c]),
    );
    const prefById = new Map(
      (prefs ?? []).map((p) => [p.profile_id as string, p]),
    );

    const rows = (profiles ?? []).map((p) => {
      const cp = cpById.get(p.id);
      const pr = prefById.get(p.id);
      return {
        profile_id: p.id,
        full_name: p.full_name ?? null,
        email: p.email,
        role: p.role as "boss" | "dispatcher" | "engineer",
        telegram_username: (cp?.telegram_username as string | null) ?? null,
        telegram_chat_id: (cp?.telegram_chat_id as string | null) ?? null,
        telegram_linked_at: (cp?.telegram_linked_at as string | null) ?? null,
        in_app_enabled: pr?.in_app_enabled ?? true,
        telegram_enabled: pr?.telegram_enabled ?? true,
        muted_types: ((pr?.muted_types as NotificationType[] | null) ?? []) as NotificationType[],
      };
    });
    return { rows };
  });

export const adminSetTelegramLink = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        profileId: z.string().uuid(),
        telegramChatId: z
          .string()
          .trim()
          .regex(/^-?\d{3,20}$/, "Chat ID must be a numeric Telegram chat id"),
        telegramUsername: z
          .string()
          .trim()
          .max(64)
          .regex(/^@?[A-Za-z0-9_]{0,64}$/, "Invalid Telegram username")
          .optional()
          .or(z.literal("")),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertBoss(context.userId);
    const username = data.telegramUsername
      ? data.telegramUsername.replace(/^@/, "")
      : null;
    const nowIso = new Date().toISOString();
    const { error } = await supabaseAdmin
      .from("user_contact_profiles")
      .upsert(
        {
          profile_id: data.profileId,
          telegram_chat_id: data.telegramChatId,
          telegram_username: username,
          telegram_linked_at: nowIso,
          updated_at: nowIso,
        },
        { onConflict: "profile_id" },
      );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminClearTelegramLink = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ profileId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertBoss(context.userId);
    const { error } = await supabaseAdmin
      .from("user_contact_profiles")
      .upsert(
        {
          profile_id: data.profileId,
          telegram_chat_id: null,
          telegram_username: null,
          telegram_linked_at: null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "profile_id" },
      );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

const NOTIFICATION_TYPES = [
  "intake_review_required",
  "duplicate_suspected",
  "work_order_assigned",
  "work_order_reassigned",
  "diary_changed",
  "engineer_rejected",
  "job_completed",
  "job_incomplete",
  "sync_failed",
  "sync_recovered",
  "planner_conflict",
  "overdue_follow_up",
  "billing_ready",
  "billing_on_hold",
  "engineer_unavailable",
] as const;

export const adminUpdateNotificationPrefs = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        profileId: z.string().uuid(),
        in_app_enabled: z.boolean().optional(),
        telegram_enabled: z.boolean().optional(),
        muted_types: z.array(z.enum(NOTIFICATION_TYPES)).max(50).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertBoss(context.userId);
    const patch: Record<string, unknown> = {
      profile_id: data.profileId,
      updated_at: new Date().toISOString(),
    };
    if (data.in_app_enabled !== undefined) patch.in_app_enabled = data.in_app_enabled;
    if (data.telegram_enabled !== undefined) patch.telegram_enabled = data.telegram_enabled;
    if (data.muted_types !== undefined) patch.muted_types = data.muted_types;

    const { error } = await supabaseAdmin
      .from("notification_preferences")
      .upsert(patch, { onConflict: "profile_id" });
    if (error) throw new Error(error.message);
    return { ok: true };
  });