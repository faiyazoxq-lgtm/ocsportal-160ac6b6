/**
 * Server-only helper that performs a Gmail inbox sync without requiring
 * an interactive user session. Used by the pg_cron-triggered auto-sync
 * endpoint so the linked company mailbox is sniffed continuously.
 */

import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  archiveAndLabelMessage,
  classifyEmail,
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

export async function performGmailSync(opts?: {
  query?: string;
  maxResults?: number;
  autoImport?: boolean;
}): Promise<GmailSyncResult> {
  if (!(await isGmailLinked())) {
    throw new Error("Gmail mailbox is not connected.");
  }

  const actor = await resolveActorUserId();
  const auto = opts?.autoImport ?? true;

  let listed: Awaited<ReturnType<typeof listMessageIds>>;
  try {
    listed = await listMessageIds({
      q: opts?.query ?? "in:inbox newer_than:30d",
      maxResults: opts?.maxResults ?? 25,
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

  for (const { id } of ids) {
    const { data: existing } = await supabaseAdmin
      .from("gmail_messages")
      .select("id, gmail_message_id, classification, triage_state")
      .eq("gmail_message_id", id)
      .maybeSingle();
    const existingRow = existing as { id: string; classification: string; triage_state: string } | null;

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

    const cls = classifyEmail({
      subject,
      body,
      fromAddress,
      hasAttachments: attach,
      attachmentFilenames,
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
            created_by: actor,
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
              imported_by: actor,
              triage_state: "reviewed",
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
  };
}