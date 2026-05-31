import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  formatDmNotification,
  resolveTelegramChatId,
  sendTelegramMessage,
} from "@/services/telegramSend.server";

// -------- get or create 1:1 thread --------
export const getOrCreateDirectThread = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ otherProfileId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { userId } = context;
    if (data.otherProfileId === userId) {
      throw new Error("Cannot open a thread with yourself");
    }
    // Find existing 1:1 thread containing both participants and exactly 2 members
    const { data: rows, error: findErr } = await supabaseAdmin
      .from("direct_message_participants")
      .select("thread_id")
      .in("profile_id", [userId, data.otherProfileId]);
    if (findErr) throw new Error(findErr.message);

    const counts = new Map<string, number>();
    for (const r of rows ?? []) {
      counts.set(r.thread_id, (counts.get(r.thread_id) ?? 0) + 1);
    }
    let threadId: string | null = null;
    for (const [tid, c] of counts) {
      if (c >= 2) {
        const { count } = await supabaseAdmin
          .from("direct_message_participants")
          .select("*", { count: "exact", head: true })
          .eq("thread_id", tid);
        if (count === 2) {
          threadId = tid;
          break;
        }
      }
    }

    if (!threadId) {
      const { data: tr, error: tErr } = await supabaseAdmin
        .from("direct_message_threads")
        .insert({ created_by: userId })
        .select("id")
        .single();
      if (tErr || !tr) throw new Error(tErr?.message ?? "Failed to create thread");
      threadId = tr.id;
      const { error: pErr } = await supabaseAdmin
        .from("direct_message_participants")
        .insert([
          { thread_id: threadId, profile_id: userId },
          { thread_id: threadId, profile_id: data.otherProfileId },
        ]);
      if (pErr) throw new Error(pErr.message);
    }
    return { threadId };
  });

// -------- send message + telegram bridge --------
export const sendDirectMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        threadId: z.string().uuid(),
        bodyText: z.string().max(8000).optional(),
        messageType: z
          .enum(["text", "image", "file", "voice_note"])
          .default("text"),
        files: z
          .array(
            z.object({
              storagePath: z.string().min(1).max(512),
              fileKind: z.string().max(64),
              mimeType: z.string().max(128).optional(),
              byteSize: z.number().int().nonnegative().optional(),
            }),
          )
          .max(10)
          .optional(),
      })
      .refine(
        (v) => (v.bodyText && v.bodyText.length > 0) || (v.files && v.files.length > 0),
        { message: "Message must include text or at least one file" },
      )
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // Verify participant via RLS-respecting client
    const { data: part, error: partErr } = await supabase
      .from("direct_message_participants")
      .select("id, profile_id")
      .eq("thread_id", data.threadId);
    if (partErr) throw new Error(partErr.message);
    if (!part?.some((p) => p.profile_id === userId)) {
      throw new Error("Not a participant of this thread");
    }

    const { data: msg, error: insErr } = await supabase
      .from("direct_messages")
      .insert({
        thread_id: data.threadId,
        sender_profile_id: userId,
        message_type: data.messageType,
        body_text: data.bodyText ?? null,
      })
      .select("*")
      .single();
    if (insErr || !msg) throw new Error(insErr?.message ?? "Failed to send");

    if (data.files?.length) {
      const fileRows = data.files.map((f) => ({
        message_id: msg.id,
        file_kind: f.fileKind,
        storage_bucket: "direct-message-attachments",
        storage_path: f.storagePath,
        mime_type: f.mimeType ?? null,
        byte_size: f.byteSize ?? null,
        uploaded_by_profile_id: userId,
      }));
      const { error: fErr } = await supabase
        .from("direct_message_files")
        .insert(fileRows);
      if (fErr) throw new Error(fErr.message);
    }

    // Mark sender as read
    await supabase
      .from("direct_message_participants")
      .update({ last_read_at: new Date().toISOString() })
      .eq("thread_id", data.threadId)
      .eq("profile_id", userId);

    // Fire-and-log telegram notifications to OTHER participants (admin-scope reads only)
    const recipients = (part ?? []).filter((p) => p.profile_id !== userId);
    if (recipients.length) {
      const { data: senderProf } = await supabaseAdmin
        .from("profiles")
        .select("full_name, email")
        .eq("id", userId)
        .maybeSingle();
      const senderName =
        senderProf?.full_name || senderProf?.email || "An OCS teammate";

      for (const r of recipients) {
        const { data: cp } = await supabaseAdmin
          .from("user_contact_profiles")
          .select("telegram_chat_id")
          .eq("profile_id", r.profile_id)
          .maybeSingle();
        const chatId = cp?.telegram_chat_id;
        if (!chatId) {
          await supabaseAdmin.from("telegram_notification_log").insert({
            profile_id: r.profile_id,
            thread_id: data.threadId,
            message_id: msg.id,
            notification_type: "direct_message",
            delivery_status: "skipped",
            error_message: "Recipient has not linked Telegram",
          });
          continue;
        }
        const text = formatDmNotification({
          senderName,
          preview: data.bodyText ?? "[attachment]",
        });
        const sendRes = await sendTelegramMessage({ chatId, text });
        await supabaseAdmin.from("telegram_notification_log").insert({
          profile_id: r.profile_id,
          thread_id: data.threadId,
          message_id: msg.id,
          notification_type: "direct_message",
          delivery_status: sendRes.ok ? "delivered" : "failed",
          error_message: sendRes.ok ? null : sendRes.error,
          sent_at: sendRes.ok ? new Date().toISOString() : null,
        });
      }
    }

    return { message: msg };
  });

// -------- mark thread read --------
export const markThreadRead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ threadId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("direct_message_participants")
      .update({ last_read_at: new Date().toISOString() })
      .eq("thread_id", data.threadId)
      .eq("profile_id", userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// -------- telegram link --------
export const linkTelegramAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        telegramUsername: z
          .string()
          .min(3)
          .max(64)
          .regex(/^@?[A-Za-z0-9_]{3,64}$/, "Invalid Telegram username"),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const username = data.telegramUsername.replace(/^@/, "");

    const resolved = await resolveTelegramChatId(username);
    if (!resolved.ok) {
      return { ok: false as const, error: resolved.error };
    }

    const nowIso = new Date().toISOString();
    const { error } = await supabaseAdmin
      .from("user_contact_profiles")
      .upsert(
        {
          profile_id: userId,
          telegram_username: username,
          telegram_chat_id: resolved.chatId,
          telegram_linked_at: nowIso,
          updated_at: nowIso,
        },
        { onConflict: "profile_id" },
      );
    if (error) throw new Error(error.message);

    // Send a confirmation ping
    await sendTelegramMessage({
      chatId: resolved.chatId,
      text: "<b>OCS</b> ✅ Telegram linked. You will receive work-message notifications here.",
    });
    return { ok: true as const };
  });

export const unlinkTelegramAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId } = context;
    const { error } = await supabaseAdmin
      .from("user_contact_profiles")
      .upsert(
        {
          profile_id: userId,
          telegram_username: null,
          telegram_chat_id: null,
          telegram_linked_at: null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "profile_id" },
      );
    if (error) throw new Error(error.message);
    return { ok: true };
  });