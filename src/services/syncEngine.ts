import { supabase } from "@/integrations/supabase/client";
import {
  getBlob,
  listPending,
  removeMutation,
  subscribeQueue,
  updateMutation,
  type QueuedMutation,
} from "./offlineQueue";
import { uploadEvidence, type FileKind } from "./evidenceUploads";

let running = false;
let lastError: string | null = null;
let lastSyncedAt: number | null = null;

const statusListeners = new Set<() => void>();

export interface SyncEngineSnapshot {
  running: boolean;
  lastError: string | null;
  lastSyncedAt: number | null;
  online: boolean;
}

export function getSyncSnapshot(): SyncEngineSnapshot {
  return {
    running,
    lastError,
    lastSyncedAt,
    online: typeof navigator === "undefined" ? true : navigator.onLine,
  };
}

export function subscribeSync(fn: () => void): () => void {
  statusListeners.add(fn);
  return () => statusListeners.delete(fn);
}

function emit() {
  statusListeners.forEach((l) => {
    try {
      l();
    } catch {
      /* noop */
    }
  });
}

async function logEvent(
  work_order_id: string,
  event_type: string,
  event_label: string,
  payload: Record<string, unknown> = {},
) {
  const { error } = await supabase.from("work_order_events").insert({
    work_order_id,
    event_type,
    event_label,
    event_payload_json: payload as never,
  });
  if (error) throw error;
}

async function setStatus(
  work_order_id: string,
  status:
    | "en_route"
    | "on_site"
    | "field_in_progress"
    | "field_submitted_complete"
    | "field_submitted_incomplete",
  extra: Record<string, unknown> = {},
) {
  const { error } = await supabase
    .from("work_orders")
    .update({
      current_status: status,
      last_synced_at: new Date().toISOString(),
      ...extra,
    })
    .eq("id", work_order_id);
  if (error) throw error;
}

async function processOne(m: QueuedMutation): Promise<void> {
  switch (m.type) {
    case "mark_on_route": {
      await setStatus(m.work_order_id, "en_route");
      await logEvent(m.work_order_id, "milestone", "Engineer on route", {
        offline: true,
        local_id: m.id,
      });
      return;
    }
    case "mark_arrived": {
      await setStatus(m.work_order_id, "on_site");
      await logEvent(m.work_order_id, "milestone", "Engineer arrived on site", {
        offline: true,
        local_id: m.id,
      });
      return;
    }
    case "start_work": {
      await setStatus(m.work_order_id, "field_in_progress", {
        field_lock_active: true,
        field_lock_started_at: new Date().toISOString(),
        active_editor_engineer_id: m.engineer_id,
        pending_sync_flag: true,
      });
      await logEvent(m.work_order_id, "milestone", "Work in progress", {
        offline: true,
        local_id: m.id,
      });
      return;
    }
    case "checklist_save": {
      await logEvent(
        m.work_order_id,
        "checklist_save",
        "Checklist progress saved",
        m.payload as Record<string, unknown>,
      );
      return;
    }
    case "evidence_add": {
      const payload = m.payload as {
        fileKind: FileKind;
        mime: string;
      };
      const blob = m.blob_ref ? await getBlob(m.blob_ref) : null;
      if (!blob)
        throw new Error("Missing local blob for evidence upload");
      await uploadEvidence({
        workOrderId: m.work_order_id,
        engineerId: m.engineer_id,
        fileKind: payload.fileKind,
        blob,
        uploadedOffline: true,
      });
      return;
    }
    case "expense_add": {
      const payload = m.payload as {
        expense_type: string;
        amount: number;
        note?: string;
        receipt_file_id?: string | null;
      };
      const { error } = await supabase.from("work_order_expenses").insert({
        work_order_id: m.work_order_id,
        expense_type: payload.expense_type as never,
        amount: payload.amount,
        note: payload.note ?? null,
        receipt_file_id: payload.receipt_file_id ?? null,
        entered_by_engineer_id: m.engineer_id,
      });
      if (error) throw error;
      return;
    }
    case "submit_complete":
    case "submit_incomplete": {
      const payload = m.payload as {
        reason?: string | null;
        notes?: string;
        checklist?: Record<string, boolean>;
      };
      const status =
        m.type === "submit_complete"
          ? "field_submitted_complete"
          : "field_submitted_incomplete";
      await setStatus(m.work_order_id, status, {
        current_outcome_reason:
          m.type === "submit_incomplete" ? payload.reason ?? null : null,
        field_lock_active: false,
        active_editor_engineer_id: null,
        pending_sync_flag: false,
      });
      await logEvent(
        m.work_order_id,
        "field_submit",
        m.type === "submit_complete"
          ? "Engineer submitted job as complete"
          : "Engineer submitted job as incomplete",
        payload as Record<string, unknown>,
      );
      return;
    }
    default:
      throw new Error(`Unknown mutation type: ${m.type as string}`);
  }
}

const MAX_RETRIES = 5;

export async function syncNow(): Promise<{
  processed: number;
  failed: number;
}> {
  if (running) return { processed: 0, failed: 0 };
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    return { processed: 0, failed: 0 };
  }
  running = true;
  lastError = null;
  emit();

  let processed = 0;
  let failed = 0;
  try {
    const pending = await listPending();
    for (const m of pending) {
      if (m.retry_count >= MAX_RETRIES) continue;
      await updateMutation(m.id, { status: "syncing", error_message: null });
      try {
        await processOne(m);
        await removeMutation(m.id);
        processed += 1;
      } catch (err) {
        failed += 1;
        const msg = err instanceof Error ? err.message : String(err);
        lastError = msg;
        await updateMutation(m.id, {
          status: "failed",
          retry_count: m.retry_count + 1,
          error_message: msg,
          last_attempt_at: Date.now(),
        });
      }
    }
    lastSyncedAt = Date.now();
  } finally {
    running = false;
    emit();
  }
  return { processed, failed };
}

let booted = false;

/**
 * Wire automatic sync on app start + on `online` events + every 60s while online.
 * Safe to call once at the app root.
 */
export function bootSyncEngine() {
  if (booted || typeof window === "undefined") return;
  booted = true;

  // Attempt on startup
  void syncNow();

  // Sync whenever the queue changes (debounced via microtask)
  let scheduled = false;
  subscribeQueue(() => {
    if (scheduled) return;
    scheduled = true;
    queueMicrotask(() => {
      scheduled = false;
      void syncNow();
    });
  });

  // Reconnect
  window.addEventListener("online", () => {
    emit();
    void syncNow();
  });
  window.addEventListener("offline", emit);

  // Periodic retry every 60s while online
  setInterval(() => {
    if (typeof navigator !== "undefined" && navigator.onLine) {
      void syncNow();
    }
  }, 60_000);
}