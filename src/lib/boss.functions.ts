import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

/** Throws if the caller is not a boss. */
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

async function logBossAction(args: {
  actor: string;
  action: string;
  targetType?: string | null;
  targetId?: string | null;
  reason?: string | null;
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
  context?: Record<string, unknown>;
}) {
  await supabaseAdmin.from("boss_audit_log").insert({
    actor_profile_id: args.actor,
    action_type: args.action,
    target_type: args.targetType ?? null,
    target_id: args.targetId ?? null,
    reason: args.reason ?? null,
    before_json: (args.before ?? {}) as never,
    after_json: (args.after ?? {}) as never,
    context_json: (args.context ?? {}) as never,
  } as never);
}

/* ============================================================
 * Staff management
 * ============================================================ */

const RoleEnum = z.enum(["boss", "dispatcher", "engineer"]);

export const bossCreateStaffAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: {
    email: string;
    password: string;
    role: "boss" | "dispatcher" | "engineer";
    full_name?: string | null;
    phone?: string | null;
  }) =>
    z
      .object({
        email: z.string().email(),
        password: z.string().min(8).max(200),
        role: RoleEnum,
        full_name: z.string().max(200).nullish(),
        phone: z.string().max(50).nullish(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    await assertBoss(context.supabase, context.userId);

    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
      user_metadata: {
        full_name: data.full_name ?? null,
        phone: data.phone ?? null,
        role: data.role,
      },
    });
    if (error || !created.user) {
      throw new Error(error?.message ?? "Failed to create account");
    }

    // handle_new_user trigger writes profiles + user_roles using the metadata role.
    await logBossAction({
      actor: context.userId,
      action: "account_created",
      targetType: "profile",
      targetId: created.user.id,
      after: { email: data.email, role: data.role, full_name: data.full_name ?? null },
    });

    return { userId: created.user.id };
  });

export const bossSetAccountActive = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { profileId: string; active: boolean; reason?: string }) =>
    z
      .object({
        profileId: z.string().uuid(),
        active: z.boolean(),
        reason: z.string().max(500).optional(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    await assertBoss(context.supabase, context.userId);

    const { data: before } = await supabaseAdmin
      .from("profiles")
      .select("is_active, disabled_at, disabled_by")
      .eq("id", data.profileId)
      .maybeSingle();

    const patch = data.active
      ? { is_active: true, disabled_at: null, disabled_by: null }
      : { is_active: false, disabled_at: new Date().toISOString(), disabled_by: context.userId };

    const { error } = await supabaseAdmin
      .from("profiles")
      .update(patch)
      .eq("id", data.profileId);
    if (error) throw new Error(error.message);

    // Also ban/unban at the auth layer so disabled users can't keep a session.
    await supabaseAdmin.auth.admin.updateUserById(data.profileId, {
      ban_duration: data.active ? "none" : "8760h", // ~1 year ban; reactivation clears it
    });

    await logBossAction({
      actor: context.userId,
      action: data.active ? "account_reactivated" : "account_disabled",
      targetType: "profile",
      targetId: data.profileId,
      reason: data.reason ?? null,
      before: before ?? {},
      after: patch,
    });
    return { ok: true };
  });

export const bossResetPassword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { profileId: string; email: string; reason?: string }) =>
    z
      .object({
        profileId: z.string().uuid(),
        email: z.string().email(),
        reason: z.string().max(500).optional(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    await assertBoss(context.supabase, context.userId);

    const { data: linkData, error } = await supabaseAdmin.auth.admin.generateLink({
      type: "recovery",
      email: data.email,
    });
    if (error) throw new Error(error.message);

    await supabaseAdmin
      .from("profiles")
      .update({
        password_reset_requested_at: new Date().toISOString(),
        password_reset_requested_by: context.userId,
      })
      .eq("id", data.profileId);

    await logBossAction({
      actor: context.userId,
      action: "password_reset_initiated",
      targetType: "profile",
      targetId: data.profileId,
      reason: data.reason ?? null,
      after: { email: data.email },
    });

    // The link is returned so the boss can hand it off if email delivery is not yet wired.
    return { recoveryLink: linkData?.properties?.action_link ?? null };
  });

export const bossUpdateStaffProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: {
    profileId: string;
    full_name?: string | null;
    phone?: string | null;
    work_email?: string | null;
    role?: "boss" | "dispatcher" | "engineer";
    reason?: string;
  }) =>
    z
      .object({
        profileId: z.string().uuid(),
        full_name: z.string().max(200).nullish(),
        phone: z.string().max(50).nullish(),
        work_email: z
          .union([z.string().email().max(200), z.literal(""), z.null()])
          .optional()
          .transform((v) => (v === "" ? null : v)),
        role: RoleEnum.optional(),
        reason: z.string().max(500).optional(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    await assertBoss(context.supabase, context.userId);

    const { data: before } = await supabaseAdmin
      .from("profiles")
      .select("full_name, phone, work_email, role")
      .eq("id", data.profileId)
      .maybeSingle();

    const patch: Record<string, unknown> = {};
    if (data.full_name !== undefined) patch.full_name = data.full_name;
    if (data.phone !== undefined) patch.phone = data.phone;
    if (data.work_email !== undefined) patch.work_email = data.work_email;
    if (data.role) patch.role = data.role;

    if (Object.keys(patch).length) {
      const { error } = await supabaseAdmin
        .from("profiles")
        .update(patch as never)
        .eq("id", data.profileId);
      if (error) throw new Error(error.message);
    }

    if (data.role && before?.role !== data.role) {
      // Sync user_roles: keep a single canonical role row per user.
      await supabaseAdmin.from("user_roles").delete().eq("user_id", data.profileId);
      await supabaseAdmin
        .from("user_roles")
        .insert({ user_id: data.profileId, role: data.role });

      await logBossAction({
        actor: context.userId,
        action: "role_changed",
        targetType: "profile",
        targetId: data.profileId,
        reason: data.reason ?? null,
        before: { role: before?.role ?? null },
        after: { role: data.role },
      });
    }

    if (
      (data.full_name !== undefined && before?.full_name !== data.full_name) ||
      (data.phone !== undefined && before?.phone !== data.phone)
    ) {
      await logBossAction({
        actor: context.userId,
        action: "profile_edited",
        targetType: "profile",
        targetId: data.profileId,
        reason: data.reason ?? null,
        before: before ?? {},
        after: patch,
      });
    }

    return { ok: true };
  });

/* ============================================================
 * Job overrides
 * ============================================================ */

export const bossSetTempPassword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { profileId: string; tempPassword: string; reason?: string }) =>
    z
      .object({
        profileId: z.string().uuid(),
        tempPassword: z.string().min(8).max(100),
        reason: z.string().max(500).optional(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    await assertBoss(context.supabase, context.userId);

    const { error } = await supabaseAdmin.auth.admin.updateUserById(data.profileId, {
      password: data.tempPassword,
    });
    if (error) throw new Error(error.message);

    await supabaseAdmin
      .from("profiles")
      .update({
        temp_password_set_at: new Date().toISOString(),
        temp_password_set_by: context.userId,
      } as never)
      .eq("id", data.profileId);

    await logBossAction({
      actor: context.userId,
      action: "temp_password_set",
      targetType: "profile",
      targetId: data.profileId,
      reason: data.reason ?? null,
      after: { temp_password_set: true },
    });

    return { ok: true };
  });


export const bossOverrideWorkOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: {
    workOrderId: string;
    reason: string;
    changes: Partial<{
      current_status: string;
      diary_date: string | null;
      scheduled_start_at: string | null;
      scheduled_end_at: string | null;
      priority_level: string;
      admin_notes: string;
      field_lock_active: boolean;
    }>;
  }) =>
    z
      .object({
        workOrderId: z.string().uuid(),
        reason: z.string().min(3).max(500),
        changes: z
          .object({
            current_status: z.string().max(60).optional(),
            diary_date: z.string().nullable().optional(),
            scheduled_start_at: z.string().nullable().optional(),
            scheduled_end_at: z.string().nullable().optional(),
            priority_level: z.string().max(20).optional(),
            admin_notes: z.string().max(4000).optional(),
            field_lock_active: z.boolean().optional(),
          })
          .refine((v) => Object.keys(v).length > 0, "No changes supplied"),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    await assertBoss(context.supabase, context.userId);

    const { data: before, error: readErr } = await supabaseAdmin
      .from("work_orders")
      .select("id, current_status, diary_date, scheduled_start_at, scheduled_end_at, priority_level, admin_notes, field_lock_active")
      .eq("id", data.workOrderId)
      .single();
    if (readErr || !before) throw new Error("Work order not found");

    const patch = { ...data.changes, updated_at: new Date().toISOString() } as Record<string, unknown>;
    const { error } = await supabaseAdmin
      .from("work_orders")
      .update(patch as never)
      .eq("id", data.workOrderId);
    if (error) throw new Error(error.message);

    // Pick action label based on what changed.
    const changedKeys = Object.keys(data.changes);
    let action = "job_edited";
    if (changedKeys.includes("field_lock_active") && data.changes.field_lock_active === false) {
      action = "record_force_unlocked";
    } else if (
      changedKeys.includes("current_status") &&
      typeof data.changes.current_status === "string"
    ) {
      action = ["closed", "cancelled"].includes(before.current_status)
        ? "job_reopened"
        : "status_overridden";
    }

    await logBossAction({
      actor: context.userId,
      action,
      targetType: "work_order",
      targetId: data.workOrderId,
      reason: data.reason,
      before,
      after: patch,
    });

    return { ok: true };
  });

export const bossOverrideAssignment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: {
    workOrderId: string;
    engineerId: string;
    role: "lead" | "support";
    reason: string;
    replaceExistingLead?: boolean;
  }) =>
    z
      .object({
        workOrderId: z.string().uuid(),
        engineerId: z.string().uuid(),
        role: z.enum(["lead", "support"]),
        reason: z.string().min(3).max(500),
        replaceExistingLead: z.boolean().optional(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    await assertBoss(context.supabase, context.userId);

    const { data: existing } = await supabaseAdmin
      .from("work_order_assignments")
      .select("id, engineer_id, assignment_role, assignment_status")
      .eq("work_order_id", data.workOrderId);

    if (data.role === "lead" && data.replaceExistingLead) {
      const leadIds = (existing ?? [])
        .filter((a) => a.assignment_role === "lead")
        .map((a) => a.id);
      if (leadIds.length) {
        await supabaseAdmin
          .from("work_order_assignments")
          .delete()
          .in("id", leadIds);
      }
    }

    const { data: inserted, error } = await supabaseAdmin
      .from("work_order_assignments")
      .insert({
        work_order_id: data.workOrderId,
        engineer_id: data.engineerId,
        assignment_role: data.role,
        assignment_status: "assigned",
        assigned_by: context.userId,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);

    await logBossAction({
      actor: context.userId,
      action: "assignment_overridden",
      targetType: "work_order",
      targetId: data.workOrderId,
      reason: data.reason,
      before: { previous_assignments: existing ?? [] },
      after: { added: inserted, role: data.role, engineer_id: data.engineerId },
    });

    return { assignmentId: inserted.id };
  });