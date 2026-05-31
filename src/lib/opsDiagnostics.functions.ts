import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import process from "node:process";

async function assertDispatcher(supabase: any, userId: string) {
  const { data, error } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "dispatcher")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Dispatcher role required");
}

async function countBy(
  supabase: any,
  table: string,
  filters: (q: any) => any,
): Promise<number> {
  const q = supabase.from(table).select("id", { count: "exact", head: true });
  const { count, error } = await filters(q);
  if (error) return 0;
  return count ?? 0;
}

export const getOpsDiagnostics = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    await assertDispatcher(supabase, userId);

    const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const nowIso = new Date().toISOString();

    // --- Intake / parser ---
    const [
      intakeNeedsReview,
      intakeDuplicates,
      intakeFailedParse,
      intakeReceived,
      intakeConverted24h,
    ] = await Promise.all([
      countBy(supabase, "intake_records", (q) => q.eq("parse_status", "needs_review")),
      countBy(supabase, "intake_records", (q) => q.eq("parse_status", "duplicate_suspected")),
      countBy(supabase, "intake_records", (q) => q.not("parse_error", "is", null)),
      countBy(supabase, "intake_records", (q) => q.eq("parse_status", "received")),
      countBy(supabase, "intake_records", (q) =>
        q.eq("parse_status", "converted").gte("updated_at", dayAgo),
      ),
    ]);

    const { data: lastParse } = await supabase
      .from("intake_records")
      .select("id, parser_version, parse_method, parsing_completed_at, parse_error, parse_status")
      .not("parsing_completed_at", "is", null)
      .order("parsing_completed_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    // --- Work orders ---
    const [woPendingSync, woPlannerConflicts, woFieldLocked, woAwaitingReview] = await Promise.all([
      countBy(supabase, "work_orders", (q) => q.eq("pending_sync_flag", true)),
      countBy(supabase, "work_orders", (q) => q.eq("planner_conflict_flag", true)),
      countBy(supabase, "work_orders", (q) => q.eq("field_lock_active", true)),
      countBy(supabase, "work_orders", (q) =>
        q.in("current_status", ["field_submitted_complete", "field_submitted_incomplete", "dispatcher_review"]),
      ),
    ]);

    // --- Sync log (planner) ---
    const [syncFailures24h, syncConflicts24h] = await Promise.all([
      countBy(supabase, "sheet_sync_log", (q) =>
        q.eq("sync_status", "failed").gte("created_at", dayAgo),
      ),
      countBy(supabase, "sheet_sync_log", (q) =>
        q.eq("sync_status", "conflict").gte("created_at", dayAgo),
      ),
    ]);
    const { data: lastSync } = await supabase
      .from("sheet_sync_log")
      .select("id, sync_direction, sync_status, sheet_name, synced_at, error_message")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    // --- Files ---
    const fileSyncFailed = await countBy(supabase, "work_order_files", (q) =>
      q.eq("sync_status", "failed"),
    );
    const fileSyncPending = await countBy(supabase, "work_order_files", (q) =>
      q.in("sync_status", ["pending", "syncing"]),
    );

    // --- Telegram ---
    const [telegramPending, telegramFailed24h] = await Promise.all([
      countBy(supabase, "notifications", (q) =>
        q.eq("telegram_delivery_status", "pending"),
      ),
      countBy(supabase, "notifications", (q) =>
        q.eq("telegram_delivery_status", "failed").gte("created_at", dayAgo),
      ),
    ]);

    // --- Billing ---
    const billingPendingReview = await countBy(supabase, "billing_cases", (q) =>
      q.eq("billing_status", "pending_review"),
    );
    const billingOnHold = await countBy(supabase, "billing_cases", (q) =>
      q.eq("billing_status", "on_hold"),
    );

    // --- Follow-ups ---
    const followUpsOverdue = await countBy(supabase, "communication_log_entries", (q) =>
      q
        .eq("requires_follow_up", true)
        .lt("follow_up_due_at", nowIso)
        .not("follow_up_status", "in", "(information_given,not_required)"),
    );

    // --- Staged / environment ---
    const stagedWorkOrders = await countBy(supabase, "work_orders", (q) =>
      q.ilike("order_no", "OCS-DEMO-%"),
    );

    // --- Connectivity (presence only, no secret values) ---
    const env = {
      nodeEnv: process.env.NODE_ENV ?? "unknown",
      appEnv:
        process.env.VITE_APP_ENV ??
        process.env.APP_ENV ??
        (process.env.NODE_ENV === "production" ? "production" : "development"),
      telegramConfigured: !!process.env.TELEGRAM_API_KEY,
      plannerConfigured:
        !!process.env.PLANNER_SPREADSHEET_ID && !!process.env.GOOGLE_SERVICE_ACCOUNT_JSON,
      lovableAiConfigured: !!process.env.LOVABLE_API_KEY,
      serviceRoleConfigured: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
    };

    return {
      generatedAt: nowIso,
      env,
      intake: {
        receivedQueue: intakeReceived,
        needsReview: intakeNeedsReview,
        duplicatesSuspected: intakeDuplicates,
        parseFailures: intakeFailedParse,
        convertedLast24h: intakeConverted24h,
        lastParseRun: lastParse ?? null,
      },
      workOrders: {
        pendingSync: woPendingSync,
        plannerConflicts: woPlannerConflicts,
        fieldLocked: woFieldLocked,
        awaitingReview: woAwaitingReview,
      },
      planner: {
        syncFailures24h,
        syncConflicts24h,
        lastSync: lastSync ?? null,
      },
      files: {
        failedSync: fileSyncFailed,
        pendingSync: fileSyncPending,
      },
      telegram: {
        pending: telegramPending,
        failed24h: telegramFailed24h,
      },
      billing: {
        pendingReview: billingPendingReview,
        onHold: billingOnHold,
      },
      followUps: {
        overdue: followUpsOverdue,
      },
      seed: {
        stagedWorkOrders,
      },
    };
  });