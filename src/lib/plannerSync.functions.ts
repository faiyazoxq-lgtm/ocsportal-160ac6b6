import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  PLANNER_HEADERS,
  readAllPlannerRows,
  readPlannerRowByKey,
  upsertPlannerRow,
  getPlannerConfig,
  type PlannerRow,
} from "@/services/googleSheetsSync.server";
import {
  buildPlannerRow,
  hashRow,
  type PlannerSourceWorkOrder,
} from "./plannerSync.server";

const WO_SELECT = `
  id, order_no, address_line_1, address_line_2, city, postcode, postcode_zone, priority_level, diary_date, diary_slot_label,
  engineers_required, current_status, review_outcome, duplicate_flag, admin_notes,
  planner_sheet_name, planner_row_key, planner_last_pushed_at, planner_last_pulled_at,
  planner_last_pushed_hash, planner_last_pulled_hash,
  client:clients ( client_name ),
  assignments:work_order_assignments (
    assignment_role, assignment_status,
    engineer:engineers ( display_name )
  )
`;

async function assertDispatcher(supabase: any, userId: string) {
  const { data, error } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "dispatcher")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Only dispatchers can run planner sync");
}

async function logSync(
  supabase: any,
  entry: {
    work_order_id: string | null;
    sheet_name: string;
    sheet_row_key: string | null;
    sync_direction: "app_to_sheet" | "sheet_to_app";
    sync_status: "success" | "failed" | "conflict" | "skipped";
    payload_snapshot_json?: unknown;
    error_message?: string | null;
    triggered_by?: string | null;
  },
) {
  await supabase.from("sheet_sync_log").insert({
    work_order_id: entry.work_order_id,
    sheet_name: entry.sheet_name,
    sheet_row_key: entry.sheet_row_key,
    sync_direction: entry.sync_direction,
    sync_status: entry.sync_status,
    payload_snapshot_json: entry.payload_snapshot_json ?? {},
    error_message: entry.error_message ?? null,
    triggered_by: entry.triggered_by ?? null,
    synced_at: new Date().toISOString(),
  });
}

// --------------------- PUSH ---------------------

export const pushWorkOrderToSheet = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ workOrderId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertDispatcher(supabase, userId);
    const { sheetName } = getPlannerConfig();

    const { data: wo, error } = await supabase
      .from("work_orders")
      .select(WO_SELECT)
      .eq("id", data.workOrderId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!wo) throw new Error("Work order not found");

    const row = buildPlannerRow(wo as unknown as PlannerSourceWorkOrder);
    try {
      const { rowKey } = await upsertPlannerRow(row);
      const hash = await hashRow(row);
      await supabase
        .from("work_orders")
        .update({
          planner_sheet_name: sheetName,
          planner_row_key: rowKey,
          planner_last_pushed_at: new Date().toISOString(),
          planner_last_pushed_hash: hash,
          planner_conflict_flag: false,
          planner_conflict_message: null,
        })
        .eq("id", data.workOrderId);
      await logSync(supabase, {
        work_order_id: data.workOrderId,
        sheet_name: sheetName,
        sheet_row_key: rowKey,
        sync_direction: "app_to_sheet",
        sync_status: "success",
        payload_snapshot_json: row,
        triggered_by: userId,
      });
      return { ok: true, rowKey };
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      await logSync(supabase, {
        work_order_id: data.workOrderId,
        sheet_name: sheetName,
        sheet_row_key: row.order_no,
        sync_direction: "app_to_sheet",
        sync_status: "failed",
        payload_snapshot_json: row,
        error_message: message,
        triggered_by: userId,
      });
      throw new Error(message);
    }
  });

// --------------------- BATCH PUSH ---------------------

export const pushBatchToSheet = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ workOrderIds: z.array(z.string().uuid()).min(1).max(100) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertDispatcher(supabase, userId);
    const { sheetName } = getPlannerConfig();

    const { data: rows, error } = await supabase
      .from("work_orders")
      .select(WO_SELECT)
      .in("id", data.workOrderIds);
    if (error) throw new Error(error.message);

    let success = 0;
    let failed = 0;
    for (const wo of rows ?? []) {
      const w = wo as unknown as PlannerSourceWorkOrder;
      const row = buildPlannerRow(w);
      try {
        const { rowKey } = await upsertPlannerRow(row);
        const hash = await hashRow(row);
        await supabase
          .from("work_orders")
          .update({
            planner_sheet_name: sheetName,
            planner_row_key: rowKey,
            planner_last_pushed_at: new Date().toISOString(),
            planner_last_pushed_hash: hash,
            planner_conflict_flag: false,
            planner_conflict_message: null,
          })
          .eq("id", w.id);
        await logSync(supabase, {
          work_order_id: w.id,
          sheet_name: sheetName,
          sheet_row_key: rowKey,
          sync_direction: "app_to_sheet",
          sync_status: "success",
          payload_snapshot_json: row,
          triggered_by: userId,
        });
        success++;
      } catch (e) {
        failed++;
        await logSync(supabase, {
          work_order_id: w.id,
          sheet_name: sheetName,
          sheet_row_key: row.order_no,
          sync_direction: "app_to_sheet",
          sync_status: "failed",
          payload_snapshot_json: row,
          error_message: e instanceof Error ? e.message : String(e),
          triggered_by: userId,
        });
      }
    }
    return { ok: true, success, failed };
  });

// --------------------- PULL (single or all) ---------------------

function pullableUpdatesFromRow(sheetRow: PlannerRow, wo: any): Record<string, string | null> {
  const updates: Record<string, string | null> = {};
  const sheetDiary = sheetRow.diary_date?.trim() || null;
  const sheetSlot = sheetRow.diary_slot?.trim() || null;
  const sheetNotes = sheetRow.admin_notes?.trim() || null;

  if ((wo.diary_date ?? null) !== sheetDiary) updates.diary_date = sheetDiary;
  if ((wo.diary_slot_label ?? null) !== sheetSlot) updates.diary_slot_label = sheetSlot;
  // For notes, only sync if sheet has non-empty and differs from app
  if (sheetNotes && (wo.admin_notes ?? "").trim() !== sheetNotes) {
    updates.admin_notes = sheetNotes;
  }
  return updates;
}

export const pullPlannerUpdates = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({ workOrderId: z.string().uuid().optional() })
      .parse(input ?? {}),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertDispatcher(supabase, userId);
    const { sheetName } = getPlannerConfig();

    const sheetRows = await readAllPlannerRows();
    const byKey = new Map(sheetRows.map((r) => [r.row.order_no, r.row]));

    let query = supabase.from("work_orders").select(WO_SELECT);
    if (data.workOrderId) {
      query = query.eq("id", data.workOrderId);
    } else {
      query = query.not("planner_row_key", "is", null);
    }
    const { data: workOrders, error } = await query;
    if (error) throw new Error(error.message);

    let applied = 0;
    let conflicts = 0;
    let unchanged = 0;

    for (const wo of workOrders ?? []) {
      const w = wo as any;
      const key = w.planner_row_key ?? w.order_no;
      const sheetRow = byKey.get(key);
      if (!sheetRow) {
        unchanged++;
        continue;
      }
      const hash = await hashRow(sheetRow);
      if (w.planner_last_pulled_hash === hash) {
        unchanged++;
        continue;
      }

      const updates = pullableUpdatesFromRow(sheetRow, w);
      if (Object.keys(updates).length === 0) {
        await supabase
          .from("work_orders")
          .update({
            planner_last_pulled_at: new Date().toISOString(),
            planner_last_pulled_hash: hash,
          })
          .eq("id", w.id);
        unchanged++;
        continue;
      }

      // Conflict detection: app changed the same field after the last push
      const appChangedAfterPush =
        w.planner_last_pushed_at &&
        w.planner_last_pushed_hash &&
        (() => {
          // If current app-derived row differs from last pushed hash, app has diverged.
          return true; // we treat any pull where sheet ≠ app as needing review when push exists
        })();

      const currentAppRow = buildPlannerRow(w);
      const currentAppHash = await hashRow(currentAppRow);
      const appDivergedSincePush =
        w.planner_last_pushed_hash && currentAppHash !== w.planner_last_pushed_hash;

      if (appChangedAfterPush && appDivergedSincePush) {
        const message = `Conflict: planner sheet changed fields (${Object.keys(updates).join(", ")}) but app has also been modified since the last push. Resolve manually.`;
        await supabase
          .from("work_orders")
          .update({
            planner_conflict_flag: true,
            planner_conflict_message: message,
            planner_last_pulled_at: new Date().toISOString(),
            planner_last_pulled_hash: hash,
          })
          .eq("id", w.id);
        await logSync(supabase, {
          work_order_id: w.id,
          sheet_name: sheetName,
          sheet_row_key: key,
          sync_direction: "sheet_to_app",
          sync_status: "conflict",
          payload_snapshot_json: { sheetRow, attemptedUpdates: updates },
          error_message: message,
          triggered_by: userId,
        });
        conflicts++;
        continue;
      }

      try {
        const { error: upErr } = await supabase
          .from("work_orders")
          .update({
            ...updates,
            planner_last_pulled_at: new Date().toISOString(),
            planner_last_pulled_hash: hash,
            planner_conflict_flag: false,
            planner_conflict_message: null,
          })
          .eq("id", w.id);
        if (upErr) throw new Error(upErr.message);
        await logSync(supabase, {
          work_order_id: w.id,
          sheet_name: sheetName,
          sheet_row_key: key,
          sync_direction: "sheet_to_app",
          sync_status: "success",
          payload_snapshot_json: { updates, sheetRow },
          triggered_by: userId,
        });
        applied++;
      } catch (e) {
        await logSync(supabase, {
          work_order_id: w.id,
          sheet_name: sheetName,
          sheet_row_key: key,
          sync_direction: "sheet_to_app",
          sync_status: "failed",
          payload_snapshot_json: { updates, sheetRow },
          error_message: e instanceof Error ? e.message : String(e),
          triggered_by: userId,
        });
      }
    }

    return { ok: true, applied, conflicts, unchanged, scanned: workOrders?.length ?? 0 };
  });

// --------------------- HISTORY ---------------------

export const getSheetSyncHistory = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        workOrderId: z.string().uuid().optional(),
        limit: z.number().min(1).max(200).optional(),
      })
      .parse(input ?? {}),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertDispatcher(supabase, userId);
    let q = supabase
      .from("sheet_sync_log")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(data.limit ?? 50);
    if (data.workOrderId) q = q.eq("work_order_id", data.workOrderId);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return { rows: rows ?? [] };
  });

export const PLANNER_HEADERS_EXPORTED = PLANNER_HEADERS;