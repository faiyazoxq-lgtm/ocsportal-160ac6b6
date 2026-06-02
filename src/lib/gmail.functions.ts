import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  classifyEmail,
  extractPlainBody,
  getGmailProfile,
  getMessageFull,
  hasAttachments,
  headerValue,
  isGmailLinked,
  listMessageIds,
  modifyLabels,
  parseFrom,
  sendEmail,
  splitAddresses,
} from "./gmail.server";

async function assertBoss(supabase: any, userId: string): Promise<void> {
  const { data, error } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "boss")
    .maybeSingle();
  if (error) throw new Error("Failed to verify boss role");
  if (!data) throw new Error("Forbidden: boss role required");
}

async function logBoss(actor: string, action: string, targetId: string | null, after: Record<string, unknown>) {
  try {
    await supabaseAdmin.from("boss_audit_log").insert({
      actor_profile_id: actor,
      action_type: action,
      target_type: "gmail",
      target_id: targetId,
      before_json: {} as never,
      after_json: after as never,
      context_json: {} as never,
    } as never);
  } catch {
    // audit failures must not break primary action
  }
}

/* ============================================================
 * Status — readable by any signed-in user
 * ============================================================ */

export const getGmailMailboxStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const { data } = await supabaseAdmin
      .from("gmail_connection")
      .select("email_address, display_name, is_connected, connected_at, last_sync_at, last_sync_error, history_id")
      .eq("singleton", true)
      .maybeSingle();

    return {
      linked: await isGmailLinked(),
      record: data ?? null,
    };
  });

/* ============================================================
 * Boss-driven Google OAuth: start flow on Boss's own device
 * ============================================================ */

const StartOAuthSchema = z.object({ returnUrl: z.string().url() });

export const startGmailOAuth = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => StartOAuthSchema.parse(data))
  .handler(async ({ data, context }) => {
    await assertBoss(context.supabase, context.userId);
    const { clientId } = googleOAuthCreds();
    const state = await signState(context.userId, data.returnUrl);
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: data.returnUrl,
      response_type: "code",
      scope: GMAIL_OAUTH_SCOPES.join(" "),
      access_type: "offline",
      include_granted_scopes: "true",
      prompt: "consent",
      state,
    });
    const authorizationUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
    return { authorizationUrl };
  });

/* ============================================================
 * Finalize after OAuth return — exchange code, persist tokens
 * ============================================================ */

const FinalizeSchema = z.object({
  code: z.string().min(1).max(2048),
  state: z.string().min(1).max(2048),
  redirectUri: z.string().url(),
});

export const finalizeGmailOAuth = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => FinalizeSchema.parse(data))
  .handler(async ({ data, context }) => {
    await assertBoss(context.supabase, context.userId);
    const verified = await verifyState(data.state);
    if (verified.u !== context.userId) throw new Error("OAuth state does not match current user");
    if (verified.r !== data.redirectUri) throw new Error("OAuth redirect URI mismatch");

    // Exchange the authorization code for tokens
    const { clientId, clientSecret } = googleOAuthCreds();
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code: data.code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: data.redirectUri,
        grant_type: "authorization_code",
      }).toString(),
    });
    const tokenText = await tokenRes.text();
    if (!tokenRes.ok) {
      throw new Error(`Google token exchange failed (${tokenRes.status}): ${tokenText.slice(0, 300)}`);
    }
    const tokens = JSON.parse(tokenText) as {
      access_token: string;
      refresh_token?: string;
      expires_in: number;
      scope?: string;
      token_type?: string;
    };
    if (!tokens.refresh_token) {
      throw new Error(
        "Google did not return a refresh token. Please revoke access in your Google Account and try again.",
      );
    }
    const expiresAt = new Date(Date.now() + (tokens.expires_in - 30) * 1000).toISOString();

    // Persist tokens in the server-only secrets table
    const { error: secErr } = await supabaseAdmin
      .from("gmail_oauth_secrets" as never)
      .upsert({
        singleton: true,
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        token_type: tokens.token_type ?? "Bearer",
        scope: tokens.scope ?? null,
        expires_at: expiresAt,
        updated_at: new Date().toISOString(),
        updated_by: context.userId,
      } as never, { onConflict: "singleton" });
    if (secErr) throw new Error(`Failed to store Google tokens: ${secErr.message}`);

    // Fetch the Gmail profile using the freshly-stored token
    const profile = await getGmailProfile();

    const { error } = await supabaseAdmin
      .from("gmail_connection")
      .upsert({
        singleton: true,
        email_address: profile.emailAddress,
        display_name: profile.emailAddress,
        history_id: profile.historyId ?? null,
        connection_id: null,
        is_connected: true,
        connected_by: context.userId,
        connected_at: new Date().toISOString(),
        disconnected_at: null,
        last_sync_error: null,
      } as never, { onConflict: "singleton" });
    if (error) throw new Error(error.message);

    await logBoss(context.userId, "gmail.oauth_link", null, {
      email: profile.emailAddress,
      scopes: tokens.scope,
    });
    return { ok: true, email: profile.emailAddress };
  });

export const disconnectGmailMailbox = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertBoss(context.supabase, context.userId);
    // Clear the stored OAuth tokens (server-only table)
    await supabaseAdmin.from("gmail_oauth_secrets" as never).delete().eq("singleton", true);

    const { error } = await supabaseAdmin
      .from("gmail_connection")
      .update({
        is_connected: false,
        disconnected_by: context.userId,
        disconnected_at: new Date().toISOString(),
      } as never)
      .eq("singleton", true);
    if (error) throw new Error(error.message);
    await logBoss(context.userId, "gmail.disconnect", null, {});
    return { ok: true };
  });

/* ============================================================
 * Sync inbox: fetch latest messages, cache, classify, auto-import
 * ============================================================ */

const SyncSchema = z.object({
  query: z.string().max(200).optional(),
  maxResults: z.number().int().min(1).max(50).optional(),
  autoImport: z.boolean().optional(),
});

export const syncGmailInbox = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => SyncSchema.parse(data ?? {}))
  .handler(async ({ data, context }) => {
    await assertBoss(context.supabase, context.userId);
    if (!(await isGmailLinked())) throw new Error("Gmail mailbox is not connected.");

    const auto = data.autoImport ?? true;
    let listed: Awaited<ReturnType<typeof listMessageIds>>;
    try {
      listed = await listMessageIds({ q: data.query ?? "in:inbox newer_than:30d", maxResults: data.maxResults ?? 25 });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      await supabaseAdmin
        .from("gmail_connection")
        .update({ last_sync_error: msg, last_sync_at: new Date().toISOString() } as never)
        .eq("singleton", true);
      throw e;
    }

    const ids = listed.messages ?? [];
    const newlyCached: string[] = [];
    const autoImported: string[] = [];

    for (const { id } of ids) {
      const { data: existing } = await supabaseAdmin
        .from("gmail_messages")
        .select("id, gmail_message_id, classification")
        .eq("gmail_message_id", id)
        .maybeSingle();
      if (existing) continue;

      let full;
      try { full = await getMessageFull(id); } catch { continue; }

      const headers = full.payload?.headers;
      const subject = headerValue(headers, "Subject");
      const fromRaw = headerValue(headers, "From");
      const toRaw = headerValue(headers, "To");
      const ccRaw = headerValue(headers, "Cc");
      const { name: fromName, address: fromAddress } = parseFrom(fromRaw);
      const body = extractPlainBody(full.payload);
      const attach = hasAttachments(full.payload);
      const labels = full.labelIds ?? [];
      const isUnread = labels.includes("UNREAD");
      const internalDate = full.internalDate
        ? new Date(Number(full.internalDate)).toISOString()
        : null;

      const cls = classifyEmail({
        subject,
        body,
        fromAddress,
        hasAttachments: attach,
      });
      const classification: "work_order_candidate" | "not_work_order" = cls.isWorkOrder
        ? "work_order_candidate"
        : "not_work_order";

      const { data: inserted, error: insertErr } = await supabaseAdmin
        .from("gmail_messages")
        .insert({
          gmail_message_id: id,
          gmail_thread_id: full.threadId,
          history_id: full.historyId ?? null,
          internal_date: internalDate,
          from_address: fromAddress,
          from_name: fromName,
          to_addresses: splitAddresses(toRaw),
          cc_addresses: splitAddresses(ccRaw),
          subject,
          snippet: full.snippet ?? null,
          body_preview: body.slice(0, 4000),
          has_attachments: attach,
          label_ids: labels,
          is_unread: isUnread,
          classification,
          classification_score: cls.score,
          classification_reasons_json: cls.reasons as never,
          classified_at: new Date().toISOString(),
        } as never)
        .select("id")
        .single();
      if (insertErr || !inserted) continue;
      newlyCached.push(id);

      // Auto-import high-confidence work-order candidates into intake pipeline
      if (auto && cls.score >= 0.6) {
        try {
          const { data: intake, error: intakeErr } = await supabaseAdmin
            .from("intake_records")
            .insert({
              source_type: "email",
              source_reference: `gmail:${id}`,
              source_sender: fromAddress,
              source_subject: subject,
              received_at: internalDate ?? new Date().toISOString(),
              raw_text: body,
              raw_payload_json: {
                gmail_message_id: id,
                gmail_thread_id: full.threadId,
                classification: cls,
              } as never,
              capture_status: "captured",
              parse_status: "received",
              created_by: context.userId,
            } as never)
            .select("id")
            .single();
          if (!intakeErr && intake) {
            await supabaseAdmin
              .from("gmail_messages")
              .update({
                classification: "imported",
                imported_intake_id: intake.id,
                imported_at: new Date().toISOString(),
                imported_by: context.userId,
                triage_state: "reviewed",
              } as never)
              .eq("id", inserted.id);
            autoImported.push(id);
          }
        } catch {
          // surface as import_error on the message
          await supabaseAdmin
            .from("gmail_messages")
            .update({ import_error: "Auto-import failed" } as never)
            .eq("id", inserted.id);
        }
      }
    }

    await supabaseAdmin
      .from("gmail_connection")
      .update({ last_sync_at: new Date().toISOString(), last_sync_error: null } as never)
      .eq("singleton", true);

    return {
      scanned: ids.length,
      cached: newlyCached.length,
      autoImported: autoImported.length,
    };
  });

/* ============================================================
 * Manual classification / triage actions
 * ============================================================ */

const TriageSchema = z.object({
  messageId: z.string().uuid(),
  action: z.enum(["mark_work_order", "mark_not_work_order", "ignore", "mark_reviewed"]),
});

export const triageGmailMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => TriageSchema.parse(data))
  .handler(async ({ data, context }) => {
    await assertBoss(context.supabase, context.userId);
    const patch: Record<string, unknown> = {
      triaged_by: context.userId,
      triaged_at: new Date().toISOString(),
    };
    if (data.action === "mark_work_order") {
      patch.classification = "work_order_candidate";
      patch.triage_state = "reviewed";
    } else if (data.action === "mark_not_work_order") {
      patch.classification = "not_work_order";
      patch.triage_state = "reviewed";
    } else if (data.action === "ignore") {
      patch.classification = "ignored";
      patch.triage_state = "ignored";
    } else {
      patch.triage_state = "reviewed";
    }
    const { error } = await supabaseAdmin
      .from("gmail_messages")
      .update(patch as never)
      .eq("id", data.messageId);
    if (error) throw new Error(error.message);
    await logBoss(context.userId, `gmail.${data.action}`, data.messageId, {});
    return { ok: true };
  });

/* ============================================================
 * Manually import a Gmail message into the intake pipeline
 * ============================================================ */

const ImportSchema = z.object({ messageId: z.string().uuid() });

export const importGmailMessageToIntake = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => ImportSchema.parse(data))
  .handler(async ({ data, context }) => {
    await assertBoss(context.supabase, context.userId);
    const { data: msg, error } = await supabaseAdmin
      .from("gmail_messages")
      .select("*")
      .eq("id", data.messageId)
      .maybeSingle();
    if (error || !msg) throw new Error("Message not found");
    if (msg.imported_intake_id) return { ok: true, intakeId: msg.imported_intake_id, alreadyImported: true };

    const { data: intake, error: intakeErr } = await supabaseAdmin
      .from("intake_records")
      .insert({
        source_type: "email",
        source_reference: `gmail:${msg.gmail_message_id}`,
        source_sender: msg.from_address,
        source_subject: msg.subject,
        received_at: msg.internal_date ?? new Date().toISOString(),
        raw_text: msg.body_preview,
        raw_payload_json: {
          gmail_message_id: msg.gmail_message_id,
          gmail_thread_id: msg.gmail_thread_id,
        } as never,
        capture_status: "captured",
        parse_status: "received",
        created_by: context.userId,
      } as never)
      .select("id")
      .single();
    if (intakeErr || !intake) throw new Error(intakeErr?.message ?? "Failed to create intake record");

    await supabaseAdmin
      .from("gmail_messages")
      .update({
        classification: "imported",
        imported_intake_id: intake.id,
        imported_at: new Date().toISOString(),
        imported_by: context.userId,
        import_error: null,
        triage_state: "reviewed",
      } as never)
      .eq("id", data.messageId);

    await logBoss(context.userId, "gmail.import_to_intake", data.messageId, { intakeId: intake.id });
    return { ok: true, intakeId: intake.id, alreadyImported: false };
  });

/* ============================================================
 * Reply via the linked Gmail mailbox
 * ============================================================ */

const ReplySchema = z.object({
  messageId: z.string().uuid(),
  body: z.string().min(1).max(20000),
  subjectOverride: z.string().max(500).optional(),
});

export const replyToGmailMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => ReplySchema.parse(data))
  .handler(async ({ data, context }) => {
    await assertBoss(context.supabase, context.userId);
    if (!(await isGmailLinked())) throw new Error("Gmail mailbox is not connected.");

    const { data: msg, error } = await supabaseAdmin
      .from("gmail_messages")
      .select("id, gmail_message_id, gmail_thread_id, from_address, subject")
      .eq("id", data.messageId)
      .maybeSingle();
    if (error || !msg) throw new Error("Message not found");
    if (!msg.from_address) throw new Error("Original sender unknown");

    // Fetch the original message to get Message-ID header for proper threading
    let inReplyTo: string | null = null;
    let references: string | null = null;
    try {
      const full = await getMessageFull(msg.gmail_message_id);
      inReplyTo = headerValue(full.payload?.headers, "Message-ID");
      const existingRefs = headerValue(full.payload?.headers, "References");
      references = existingRefs ? `${existingRefs} ${inReplyTo ?? ""}`.trim() : inReplyTo;
    } catch {
      // best-effort threading
    }

    const subject = data.subjectOverride
      ?? (msg.subject?.toLowerCase().startsWith("re:") ? msg.subject : `Re: ${msg.subject ?? ""}`);

    const sent = await sendEmail({
      to: msg.from_address,
      subject,
      body: data.body,
      threadId: msg.gmail_thread_id,
      inReplyTo,
      references,
    });

    await supabaseAdmin
      .from("gmail_messages")
      .update({
        triage_state: "replied",
        replied_at: new Date().toISOString(),
        replied_by: context.userId,
        reply_gmail_message_id: sent.id,
      } as never)
      .eq("id", data.messageId);

    // Mark original as read for tidiness
    try { await modifyLabels(msg.gmail_message_id, [], ["UNREAD"]); } catch { /* non-fatal */ }

    await logBoss(context.userId, "gmail.reply", data.messageId, { sentId: sent.id, to: msg.from_address });
    return { ok: true, sentId: sent.id };
  });