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
} from "./gmail.server";

export interface GmailSyncResult {
  scanned: number;
  cached: number;
  autoImported: number;
  reanalyzed?: number;
  reimported?: number;
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
          primary_trade: wo.primary_trade,
          complexity_level: wo.complexity_level,
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
      // In force mode, drop the "in:inbox" filter so we also re-scan
      // messages that were already archived/labeled, and broaden the window.
      q: opts?.query ?? (force ? "newer_than:60d" : "in:inbox newer_than:30d"),
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
      if (
        force &&
        auto &&
        !existingRow.imported_intake_id &&
        cls.score >= 0.5 &&
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