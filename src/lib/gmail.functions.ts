import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  classifyEmail,
  analyzeAttachmentsForWorkOrder,
  archiveAndLabelMessage,
  collectAttachmentRefs,
  extractWorkOrdersFromGmail,
  extractPlainBody,
  getGmailProfile,
  getMessageFull,
  hasAttachments,
  headerValue,
  isGmailLinked,
  listAttachmentFilenames,
  listMessageIds,
  modifyLabels,
  parseFrom,
  sendEmail,
  splitAddresses,
} from "./gmail.server";
import { createIntakeFromGmail } from "./gmailSync.server";

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

const DEFAULT_PROCESSED_LABEL = "OCS / Imported Work Orders";

async function getProcessedLabelName(): Promise<string> {
  try {
    const { data } = await supabaseAdmin
      .from("company_settings")
      .select("gmail_processed_label")
      .eq("singleton", true)
      .maybeSingle();
    const v = (data as { gmail_processed_label?: string | null } | null)?.gmail_processed_label;
    return v && v.trim().length > 0 ? v.trim() : DEFAULT_PROCESSED_LABEL;
  } catch {
    return DEFAULT_PROCESSED_LABEL;
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
 * Connect / disconnect the company mailbox
 *
 * The mailbox is the Google account that set up the Lovable Google Mail
 * connector — no per-project OAuth client is needed. "Connect" just probes
 * the connector gateway for the linked Gmail profile and records it.
 * ============================================================ */

export const connectGmailMailbox = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertBoss(context.supabase, context.userId);
    if (!(await isGmailLinked())) {
      throw new Error(
        "The Gmail connector isn't linked yet. Open Connectors in Lovable and connect Google Mail.",
      );
    }

    let profile;
    try {
      profile = await getGmailProfile();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      throw new Error(
        `Couldn't reach the linked Gmail account via the Lovable connector. ${msg}`,
      );
    }

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

    await logBoss(context.userId, "gmail.connect", null, { email: profile.emailAddress });
    return { ok: true, email: profile.emailAddress };
  });

export const disconnectGmailMailbox = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertBoss(context.supabase, context.userId);
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
        .select("id, gmail_message_id, classification, triage_state")
        .eq("gmail_message_id", id)
        .maybeSingle();
      const existingRow = existing as { id: string; classification: string; triage_state: string } | null;

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
      const attachmentFilenames = listAttachmentFilenames(full.payload);
      const labels = full.labelIds ?? [];
      const isUnread = labels.includes("UNREAD");
      const internalDate = full.internalDate
        ? new Date(Number(full.internalDate)).toISOString()
        : null;

      // If there are attachments, scan them with AI vision so images/PDFs
      // (photos of work orders, scanned job sheets, etc.) can drive the
      // classification. Skip for already-cached rows so we don't re-bill
      // the AI gateway on every sync.
      // Run AI scan on new emails, and re-run on cached emails that are
      // still pending triage (so previously misclassified attachments get
      // re-evaluated on the next Sync).
      const needsAiScan =
        attach &&
        (!existingRow ||
          (existingRow.triage_state === "pending" &&
            (existingRow.classification === "unclassified" ||
              existingRow.classification === "not_work_order" ||
              existingRow.classification === "work_order_candidate")));
      let aiVerdict: Awaited<ReturnType<typeof analyzeAttachmentsForWorkOrder>> | null = null;
      if (needsAiScan) {
        const refs = collectAttachmentRefs(full.payload);
        if (refs.length > 0) {
          try { aiVerdict = await analyzeAttachmentsForWorkOrder(id, refs); } catch { aiVerdict = null; }
        }
      }
      const enrichedBody = aiVerdict?.extractedText
        ? `${body}\n\n[ATTACHMENT EXTRACTED]\n${aiVerdict.extractedText}`
        : body;

      const cls = classifyEmail({
        subject,
        body: enrichedBody,
        fromAddress,
        hasAttachments: attach,
        attachmentFilenames,
        aiVerdict: aiVerdict ? { isWorkOrder: aiVerdict.isWorkOrder, confidence: aiVerdict.confidence, summary: aiVerdict.summary } : null,
      });
      const classification: "work_order_candidate" | "not_work_order" = cls.isWorkOrder
        ? "work_order_candidate"
        : "not_work_order";

      // Re-score messages we already cached, as long as the user hasn't
      // triaged/imported them yet. Lets improved heuristics pick up emails
      // that were previously misclassified.
      if (existingRow) {
        const triageOpen = existingRow.triage_state === "pending";
        const reclassifiable =
          existingRow.classification === "unclassified" ||
          existingRow.classification === "not_work_order" ||
          existingRow.classification === "work_order_candidate";
        if (triageOpen && reclassifiable) {
          await supabaseAdmin
            .from("gmail_messages")
            .update({
              classification,
              classification_score: cls.score,
              classification_reasons_json: cls.reasons as never,
              classified_at: new Date().toISOString(),
            } as never)
            .eq("id", existingRow.id);
        }
        continue;
      }

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
          const result = await createIntakeFromGmail({
            gmailMessageId: id,
            gmailThreadId: full.threadId,
            subject,
            fromAddress,
            body,
            internalDate,
            payload: full.payload,
            actorUserId: context.userId,
          });
          if (result.intakeIds.length > 0) {
            await supabaseAdmin
              .from("gmail_messages")
              .update({
                classification: "imported",
                imported_intake_id: result.intakeIds[0],
                imported_at: new Date().toISOString(),
                imported_by: context.userId,
                triage_state: "reviewed",
                import_error: result.error ?? null,
              } as never)
              .eq("id", inserted.id);
            autoImported.push(id);
            // Move the message out of INBOX and into the configured label.
            try {
              const labelName = await getProcessedLabelName();
              const r = await archiveAndLabelMessage(id, labelName);
              if (!r.archived) {
                await supabaseAdmin
                  .from("gmail_messages")
                  .update({ import_error: `Archived flag failed: ${r.error ?? "unknown"}` } as never)
                  .eq("id", inserted.id);
              }
            } catch {
              // best-effort; intake row is still safe
            }
          } else {
            await supabaseAdmin
              .from("gmail_messages")
              .update({ import_error: result.error ?? "Auto-import failed" } as never)
              .eq("id", inserted.id);
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

    // Re-fetch the full Gmail payload so we can scan attachments. body_preview
    // alone is truncated and has no image data.
    let full;
    try {
      full = await getMessageFull(msg.gmail_message_id);
    } catch (e) {
      throw new Error(`Failed to load Gmail message: ${e instanceof Error ? e.message : String(e)}`);
    }
    const fullBody = extractPlainBody(full.payload);
    const result = await createIntakeFromGmail({
      gmailMessageId: msg.gmail_message_id,
      gmailThreadId: msg.gmail_thread_id ?? full.threadId,
      subject: msg.subject,
      fromAddress: msg.from_address,
      body: fullBody || (msg.body_preview ?? ""),
      internalDate: msg.internal_date ?? null,
      payload: full.payload,
      actorUserId: context.userId,
    });
    if (result.intakeIds.length === 0) {
      throw new Error(result.error ?? "Failed to create intake record");
    }
    const firstIntakeId = result.intakeIds[0];

    await supabaseAdmin
      .from("gmail_messages")
      .update({
        classification: "imported",
        imported_intake_id: firstIntakeId,
        imported_at: new Date().toISOString(),
        imported_by: context.userId,
        import_error: null,
        triage_state: "reviewed",
      } as never)
      .eq("id", data.messageId);

    await logBoss(context.userId, "gmail.import_to_intake", data.messageId, {
      intakeIds: result.intakeIds,
      workOrdersExtracted: result.extracted,
    });

    // Move the email out of INBOX into the configured "processed" label.
    let archived = false;
    let labeled = false;
    let archiveError: string | undefined;
    try {
      const labelName = await getProcessedLabelName();
      const r = await archiveAndLabelMessage(msg.gmail_message_id, labelName);
      archived = r.archived;
      labeled = r.labeled;
      archiveError = r.error;
      if (!r.archived) {
        await supabaseAdmin
          .from("gmail_messages")
          .update({ import_error: `Archived flag failed: ${r.error ?? "unknown"}` } as never)
          .eq("id", data.messageId);
      }
    } catch (e) {
      archiveError = e instanceof Error ? e.message : String(e);
    }

    return {
      ok: true,
      intakeId: firstIntakeId,
      intakeIds: result.intakeIds,
      workOrdersExtracted: result.extracted,
      alreadyImported: false,
      archived,
      labeled,
      archiveError,
    };
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