/**
 * Server-only helper that performs a Gmail inbox sync without requiring
 * an interactive user session. Used by the pg_cron-triggered auto-sync
 * endpoint so the linked company mailbox is sniffed continuously.
 */

import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  archiveAndLabelMessage,
  analyzeAttachmentsForWorkOrder,
  classifyEmail,
  collectAttachmentRefs,
  extractWorkOrdersFromGmail,
  extractPlainBody,
  getMessageFull,
  hasAttachments,
  headerValue,
  isGmailLinked,
  listAttachmentFilenames,
  listMessageIds,
  parseFrom,
  splitAddresses,
  listGmailHistory,
  getGmailProfile,
} from "./gmail.server";
import { sendIntakeNotification } from "./intakeNotifications.server";

export interface GmailSyncResult {
  scanned: number;
  cached: number;
  autoImported: number;
  reanalyzed?: number;
  reimported?: number;
  removed?: number;
}

/* ---------- Inbox-removal reconciliation ----------
 * Gmail messages that the user has deleted, trashed, or archived in
 * Gmail must not keep showing as "ghost" rows in the OCS inbox. We
 * reconcile in two ways:
 *   1. Delta (cheap): `users.history.list` from the last persisted
 *      historyId — handles deletions and label removals incrementally.
 *   2. Fallback (safe): if Gmail says the historyId is too old OR none
 *      is stored yet, list the full `in:inbox` set and mark every
 *      cached row not in that set as removed.
 *
 * A row is "removed" when:
 *   - the underlying Gmail message no longer exists, OR
 *   - it no longer carries the INBOX label and the OCS app did not
 *     archive it itself (i.e. not imported/replied/ignored by us).
 * Imported / replied / ignored rows stay visible under their existing
 * filters so dispatchers can still find them in the inbox view.
 */

function isOcsManagedRow(row: {
  classification: string;
  triage_state: string;
  imported_intake_id: string | null;
}): boolean {
  return (
    !!row.imported_intake_id ||
    row.classification === "imported" ||
    row.classification === "ignored" ||
    row.triage_state === "replied" ||
    row.triage_state === "ignored"
  );
}

async function markRemoved(rowId: string, reason: string): Promise<void> {
  await supabaseAdmin
    .from("gmail_messages")
    .update({
      inbox_removed_at: new Date().toISOString(),
      inbox_removed_reason: reason,
    } as never)
    .eq("id", rowId);
}

/**
 * Delta reconciliation via Gmail history. Returns the count of newly-marked
 * removals and the latest historyId observed, or null if a full
 * reconciliation is required (history too old / not yet seeded).
 */
async function reconcileViaHistory(
  startHistoryId: string,
): Promise<{ removed: number; latestHistoryId: string | null } | null> {
  let pageToken: string | undefined;
  let removed = 0;
  let latest: string | null = null;

  do {
    const page = await listGmailHistory({
      startHistoryId,
      pageToken,
      historyTypes: ["messageDeleted", "labelAdded", "labelRemoved"],
    });
    if (!page) return null; // 404/410 — caller falls back to full sync

    if (page.historyId) latest = page.historyId;

    for (const h of page.history ?? []) {
      // Deleted from Gmail entirely (purged from trash, or hard delete).
      for (const d of h.messagesDeleted ?? []) {
        const gid = d.message.id;
        const { data } = await supabaseAdmin
          .from("gmail_messages")
          .select("id, classification, triage_state, imported_intake_id, inbox_removed_at")
          .eq("gmail_message_id", gid)
          .maybeSingle();
        const row = data as {
          id: string;
          classification: string;
          triage_state: string;
          imported_intake_id: string | null;
          inbox_removed_at: string | null;
        } | null;
        if (row && !row.inbox_removed_at) {
          await markRemoved(row.id, "deleted_from_gmail");
          removed++;
        }
      }
      // Moved to TRASH = effectively deleted from inbox.
      for (const la of h.labelsAdded ?? []) {
        if (!la.labelIds?.includes("TRASH")) continue;
        const gid = la.message.id;
        const { data } = await supabaseAdmin
          .from("gmail_messages")
          .select("id, classification, triage_state, imported_intake_id, inbox_removed_at")
          .eq("gmail_message_id", gid)
          .maybeSingle();
        const row = data as {
          id: string;
          classification: string;
          triage_state: string;
          imported_intake_id: string | null;
          inbox_removed_at: string | null;
        } | null;
        if (row && !row.inbox_removed_at) {
          await markRemoved(row.id, "trashed_in_gmail");
          removed++;
        }
      }
      // INBOX label removed (user archived in Gmail). Don't touch rows
      // that OCS itself archived after importing/replying/ignoring.
      for (const lr of h.labelsRemoved ?? []) {
        if (!lr.labelIds?.includes("INBOX")) continue;
        const gid = lr.message.id;
        const { data } = await supabaseAdmin
          .from("gmail_messages")
          .select("id, classification, triage_state, imported_intake_id, inbox_removed_at")
          .eq("gmail_message_id", gid)
          .maybeSingle();
        const row = data as {
          id: string;
          classification: string;
          triage_state: string;
          imported_intake_id: string | null;
          inbox_removed_at: string | null;
        } | null;
        if (row && !row.inbox_removed_at && !isOcsManagedRow(row)) {
          await markRemoved(row.id, "archived_in_gmail");
          removed++;
        }
      }
    }
    pageToken = page.nextPageToken;
  } while (pageToken);

  return { removed, latestHistoryId: latest };
}

/**
 * Full reconciliation fallback. Lists the entire current Gmail inbox
 * (broad window) and marks any cached row not in that set as removed,
 * provided OCS did not itself archive it.
 */
async function reconcileViaFullScan(): Promise<{ removed: number }> {
  const liveIds = new Set<string>();
  let pageToken: string | undefined;
  // Walk up to ~1500 inbox messages — enough for any active mailbox.
  // If a mailbox is larger, the per-message history-list path keeps things
  // accurate going forward.
  for (let i = 0; i < 3; i++) {
    const page = await listMessageIds({
      q: "in:inbox newer_than:180d",
      maxResults: 500,
      pageToken,
    });
    for (const m of page.messages ?? []) liveIds.add(m.id);
    pageToken = page.nextPageToken;
    if (!pageToken) break;
  }

  // Only candidates that we believe are still in the inbox view: not
  // already marked removed, not archived by OCS itself.
  const { data } = await supabaseAdmin
    .from("gmail_messages")
    .select("id, gmail_message_id, classification, triage_state, imported_intake_id")
    .is("inbox_removed_at", null)
    .limit(2000);
  const rows = (data ?? []) as Array<{
    id: string;
    gmail_message_id: string;
    classification: string;
    triage_state: string;
    imported_intake_id: string | null;
  }>;

  let removed = 0;
  for (const row of rows) {
    if (liveIds.has(row.gmail_message_id)) continue;
    if (isOcsManagedRow(row)) continue;
    await markRemoved(row.id, "missing_from_gmail_inbox");
    removed++;
  }
  return { removed };
}

/**
 * Public reconciliation entry-point. Picks delta if a historyId is stored
 * and Gmail still recognises it; otherwise full scan. Persists the latest
 * historyId so the next sync can run as a cheap delta.
 */
export async function reconcileGmailInboxRemovals(): Promise<{ removed: number }> {
  if (!(await isGmailLinked())) return { removed: 0 };

  const { data: conn } = await supabaseAdmin
    .from("gmail_connection")
    .select("history_id")
    .eq("singleton", true)
    .maybeSingle();
  const stored = (conn as { history_id?: string | null } | null)?.history_id ?? null;

  let removed = 0;
  let latestHistoryId: string | null = null;

  if (stored) {
    try {
      const delta = await reconcileViaHistory(stored);
      if (delta) {
        removed += delta.removed;
        latestHistoryId = delta.latestHistoryId;
      } else {
        // History too old — fall back to a full scan.
        const full = await reconcileViaFullScan();
        removed += full.removed;
      }
    } catch {
      // Defensive: history call failed for transient reasons. Do not
      // mass-mark rows as removed on a flaky call; let the next sync retry.
    }
  } else {
    // No baseline historyId — seed via a full reconciliation pass so
    // the next sync can switch to cheap delta mode.
    const full = await reconcileViaFullScan();
    removed += full.removed;
  }

  // Always refresh the stored historyId to the mailbox's current value
  // so subsequent syncs run as deltas.
  try {
    const profile = await getGmailProfile();
    const nextHistory = latestHistoryId ?? profile.historyId ?? null;
    if (nextHistory) {
      await supabaseAdmin
        .from("gmail_connection")
        .update({ history_id: nextHistory } as never)
        .eq("singleton", true);
    }
  } catch {
    // best-effort
  }

  return { removed };
}

/** Resolve a boss user id to attribute auto-created intake records to. */
async function resolveActorUserId(): Promise<string | null> {
  const { data } = await supabaseAdmin
    .from("user_roles")
    .select("user_id")
    .eq("role", "boss")
    .limit(1)
    .maybeSingle();
  return (data as { user_id: string } | null)?.user_id ?? null;
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

const INTAKE_PARSER_VERSION = "ocs-gmail-ai-extract/2026.06.02";

/**
 * Shared helper: turn a Gmail message into one OR MORE intake records by
 * running Gemini vision over the body + image/PDF attachments. Used by both
 * the user-driven sync (`gmail.functions.ts`) and the cron sync below.
 */
export async function createIntakeFromGmail(args: {
  gmailMessageId: string;
  gmailThreadId: string;
  subject: string | null;
  fromAddress: string | null;
  body: string;
  internalDate: string | null;
  payload: Awaited<ReturnType<typeof getMessageFull>>["payload"];
  actorUserId: string | null;
  /**
   * When true, do NOT create a placeholder intake row if the AI extraction
   * returns zero work orders. Used by force-resync so retries don't pollute
   * the Intake Queue with empty rows for marketing / unrelated emails.
   */
  requireDetected?: boolean;
  /**
   * Marks the resulting intake rows as recovered via a force re-sync from
   * a previously-missed Gmail message. Surfaced as a "Recovered" badge in
   * the Intake Queue / review drawer so dispatcher/boss can tell it apart
   * from a normal first-time capture.
   */
  recovered?: boolean;
}): Promise<{ intakeIds: string[]; extracted: number; error?: string }> {
  // Idempotency: if any intake_records row already references this Gmail
  // message, return those IDs instead of inserting duplicates. Force-resync
  // can otherwise create N copies for the same email if a prior run failed
  // after insert but before the gmail_messages row was updated.
  {
    const { data: existingIntake } = await supabaseAdmin
      .from("intake_records")
      .select("id, source_reference")
      .like("source_reference", `gmail:${args.gmailMessageId}%`);
    const rows = (existingIntake ?? []) as Array<{ id: string; source_reference: string | null }>;
    if (rows.length > 0) {
      return { intakeIds: rows.map((r) => r.id), extracted: rows.length };
    }
  }

  const refs = collectAttachmentRefs(args.payload);
  let extraction: Awaited<ReturnType<typeof extractWorkOrdersFromGmail>> | null = null;
  try {
    extraction = await extractWorkOrdersFromGmail({
      messageId: args.gmailMessageId,
      subject: args.subject,
      body: args.body,
      fromAddress: args.fromAddress,
      attachments: refs,
    });
  } catch {
    extraction = null;
  }

  const detected = extraction?.workOrders ?? [];
  if (args.requireDetected && detected.length === 0) {
    return { intakeIds: [], extracted: 0, error: extraction?.error };
  }
  const baseExtractedText = extraction?.extractedText
    ? `${args.body}\n\n[ATTACHMENT EXTRACTED]\n${extraction.extractedText}`
    : args.body;
  const total = Math.max(detected.length, 1);
  const intakeIds: string[] = [];

  for (let i = 0; i < total; i++) {
    const wo = detected[i] ?? null;
    const ef: Record<string, unknown> = wo
      ? {
          order_no: wo.order_no,
          client_name: wo.client_name,
          address_line_1: wo.address_line_1,
          city: wo.city,
          postcode: wo.postcode,
          postcode_zone: wo.postcode_zone,
          job_summary: wo.job_summary,
          job_description: wo.job_description,
          contact_name: wo.contact_name,
          contact_phone: wo.contact_phone,
        }
      : {};
    const cat: Record<string, unknown> = wo
      ? {
          priority_level: wo.priority_level ?? "normal",
          postcode_zone: wo.postcode_zone,
          engineers_required: 1,
        }
      : {};
    const missing = wo?.missing_fields ?? [
      "order_no", "client_name", "address_line_1", "postcode", "job_summary",
    ];
    const confidence = wo?.confidence ?? 0;
    const parseStatus = wo ? "needs_review" : "received";
    const captureStatus = wo ? "parsed" : "captured";

    const issues: string[] = [];
    if (wo) issues.push("Awaiting dispatcher/boss to confirm time & quotation with client");
    if (wo?.notes) issues.push(wo.notes);
    if (extraction?.error) issues.push(`AI: ${extraction.error}`);

    const subjectForRow = total > 1 && wo
      ? `${args.subject ?? "(no subject)"} — Job ${i + 1} of ${total}${wo.address_line_1 ? `: ${wo.address_line_1}` : ""}`
      : args.subject;

    const { data: intake, error: intakeErr } = await supabaseAdmin
      .from("intake_records")
      .insert({
        source_type: "email",
        source_reference: `gmail:${args.gmailMessageId}${total > 1 ? `#${i + 1}` : ""}`,
        source_sender: args.fromAddress,
        source_subject: subjectForRow,
        received_at: args.internalDate ?? new Date().toISOString(),
        raw_text: baseExtractedText.slice(0, 32000),
        extracted_text: extraction?.extractedText ?? null,
        raw_payload_json: {
          gmail_message_id: args.gmailMessageId,
          gmail_thread_id: args.gmailThreadId,
          ai_summary: extraction?.summary ?? null,
          ai_scanned_attachments: extraction?.scannedAttachments ?? 0,
          work_order_index: wo ? i + 1 : null,
          work_orders_total: total,
          source_attachments: refs.map((r) => ({ filename: r.filename, mimeType: r.mimeType, size: r.size })),
          recovered: args.recovered ? true : false,
          recovered_at: args.recovered ? new Date().toISOString() : null,
        } as never,
        extracted_fields_json: ef as never,
        suggested_categorization_json: cat as never,
        missing_fields_json: missing as never,
        parsing_issues_json: issues as never,
        parse_confidence: confidence,
        categorization_confidence: confidence,
        parse_status: parseStatus as never,
        capture_status: captureStatus,
        parse_method: wo ? "gmail_ai_extract" : "email_text",
        parser_version: INTAKE_PARSER_VERSION,
        ocr_used: (extraction?.scannedAttachments ?? 0) > 0,
        parsing_completed_at: wo ? new Date().toISOString() : null,
        created_by: args.actorUserId,
      } as never)
      .select("id")
      .single();
    if (intakeErr || !intake) {
      return { intakeIds, extracted: detected.length, error: intakeErr?.message ?? "intake insert failed" };
    }
    intakeIds.push(intake.id);
  }

  // Fire Telegram notifications for each newly-created intake row.
  // Best-effort: a failure here must not break the intake pipeline. The
  // helper is idempotent — it skips rows already stamped as notified.
  for (const id of intakeIds) {
    try {
      await sendIntakeNotification(id);
    } catch {
      /* ignore */
    }
  }

  return { intakeIds, extracted: detected.length, error: extraction?.error };
}

export async function performGmailSync(opts?: {
  query?: string;
  maxResults?: number;
  autoImport?: boolean;
  force?: boolean;
}): Promise<GmailSyncResult> {
  if (!(await isGmailLinked())) {
    throw new Error("Gmail mailbox is not connected.");
  }

  const actor = await resolveActorUserId();
  const auto = opts?.autoImport ?? true;
  const force = opts?.force ?? false;

  let listed: Awaited<ReturnType<typeof listMessageIds>>;
  try {
    listed = await listMessageIds({
      // Force mode: drop the "in:inbox" filter so archived/labeled messages
      // (including ones already auto-moved to the processed label) are
      // re-fetched, and broaden the window.
      q: opts?.query ?? (force ? "newer_than:90d -in:trash -in:spam" : "in:inbox newer_than:30d"),
      maxResults: opts?.maxResults ?? (force ? 100 : 25),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await supabaseAdmin
      .from("gmail_connection")
      .update({
        last_sync_error: msg,
        last_sync_at: new Date().toISOString(),
      } as never)
      .eq("singleton", true);
    throw e;
  }

  const ids = listed.messages ?? [];
  const newlyCached: string[] = [];
  const autoImported: string[] = [];
  let reanalyzed = 0;
  let reimported = 0;

  for (const { id } of ids) {
    const { data: existing } = await supabaseAdmin
      .from("gmail_messages")
      .select("id, gmail_message_id, classification, triage_state, imported_intake_id")
      .eq("gmail_message_id", id)
      .maybeSingle();
    const existingRow = existing as {
      id: string;
      classification: string;
      triage_state: string;
      imported_intake_id: string | null;
    } | null;

    let full;
    try {
      full = await getMessageFull(id);
    } catch {
      continue;
    }

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

    const needsAiScan =
      attach &&
      (force ||
        !existingRow ||
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
      if (existingRow) reanalyzed++;
    }
    // If this email already has an associated intake row, record that it was
    // re-analyzed so the Intake Queue can flag it for dispatcher/boss.
    if (aiVerdict && existingRow?.imported_intake_id) {
      const { data: existingIntake } = await supabaseAdmin
        .from("intake_records")
        .select("raw_payload_json")
        .eq("id", existingRow.imported_intake_id)
        .maybeSingle();
      const prev = ((existingIntake as { raw_payload_json?: Record<string, unknown> } | null)
        ?.raw_payload_json ?? {}) as Record<string, unknown>;
      await supabaseAdmin
        .from("intake_records")
        .update({
          raw_payload_json: {
            ...prev,
            reanalyzed: true,
            reanalyzed_at: new Date().toISOString(),
            ai_summary: aiVerdict.summary ?? (prev.ai_summary as string | null) ?? null,
          } as never,
        } as never)
        .eq("id", existingRow.imported_intake_id);
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

    if (existingRow) {
      const triageOpen = existingRow.triage_state === "pending";
      const reclassifiable =
        existingRow.classification === "unclassified" ||
        existingRow.classification === "not_work_order" ||
        existingRow.classification === "work_order_candidate";
      if ((triageOpen && reclassifiable) || force) {
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
      // In force mode, retry intake creation for previously-cached messages
      // that never made it into the Intake Queue but look like a candidate now.
      // We lower the bar in force mode: any unimported message that either
      // scores above the soft threshold OR carries attachments (where AI
      // vision can still surface a work order) gets a retry. The AI
      // extractor returns an empty list if it's really not a work order.
      if (
        force &&
        auto &&
        !existingRow.imported_intake_id &&
        (cls.score >= 0.3 || attach) &&
        existingRow.classification !== "ignored"
      ) {
        try {
          const result = await createIntakeFromGmail({
            gmailMessageId: id,
            gmailThreadId: full.threadId,
            subject,
            fromAddress,
            body,
            internalDate,
            payload: full.payload,
            actorUserId: actor,
            requireDetected: true,
            recovered: true,
          });
          if (result.intakeIds.length > 0) {
            await supabaseAdmin
              .from("gmail_messages")
              .update({
                classification: "imported",
                imported_intake_id: result.intakeIds[0],
                imported_at: new Date().toISOString(),
                imported_by: actor,
                triage_state: "reviewed",
                import_error: result.error ?? null,
              } as never)
              .eq("id", existingRow.id);
            reimported++;
            try {
              const labelName = await getProcessedLabelName();
              await archiveAndLabelMessage(id, labelName);
            } catch {
              // best-effort
            }
          }
        } catch {
          // surfaced via existing import_error column otherwise
        }
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

    // Best-effort: if this sender is not yet a client/contact, queue a
    // follow-up so the bot can prompt the boss/dispatchers to file them.
    try {
      const { maybeCreateUnknownEmailFollowup } = await import("@/lib/telegramConsole.server");
      await maybeCreateUnknownEmailFollowup({
        fromAddress: fromAddress,
        fromName: fromName,
        subject,
        snippet: full.snippet ?? body.slice(0, 200),
      });
    } catch {
      // non-fatal
    }

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
          actorUserId: actor,
        });
        if (result.intakeIds.length > 0) {
          await supabaseAdmin
            .from("gmail_messages")
            .update({
              classification: "imported",
              imported_intake_id: result.intakeIds[0],
              imported_at: new Date().toISOString(),
              imported_by: actor,
              triage_state: "reviewed",
              import_error: result.error ?? null,
            } as never)
            .eq("id", inserted.id);
          autoImported.push(id);
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
            // best-effort
          }
        }
      } catch {
        await supabaseAdmin
          .from("gmail_messages")
          .update({ import_error: "Auto-import failed" } as never)
          .eq("id", inserted.id);
      }
    }
  }

  await supabaseAdmin
    .from("gmail_connection")
    .update({
      last_sync_at: new Date().toISOString(),
      last_sync_error: null,
    } as never)
    .eq("singleton", true);

  return {
    scanned: ids.length,
    cached: newlyCached.length,
    autoImported: autoImported.length,
    reanalyzed,
    reimported,
  };
}