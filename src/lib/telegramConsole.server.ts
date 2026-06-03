// OCSBot operational console — handlers for predefined action buttons.
// All queries use supabaseAdmin (RLS bypassed) but the webhook authorises
// the caller against linked Boss/Dispatcher chat_ids before dispatching.

import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { buildWorkOrderPdf } from "@/lib/workOrderPdf.server";

const APP_BASE = "https://ocsportal.lovable.app";
const PAGE_SIZE = 8;

// ---------- helpers ----------

export function escapeHtml(s: string | null | undefined): string {
  if (!s) return "";
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function todayBounds() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  return { startIso: start.toISOString(), endIso: end.toISOString(), dateStr: start.toISOString().slice(0, 10) };
}

function priorityIcon(p: string | null | undefined): string {
  switch (p) {
    case "urgent": return "🚨";
    case "high":   return "⚡";
    case "low":    return "🟢";
    default:       return "•";
  }
}

function statusShort(s: string | null | undefined): string {
  return (s ?? "").replaceAll("_", " ");
}

// ---------- keyboards ----------

export type InlineKeyboard = { inline_keyboard: Array<Array<{ text: string; callback_data?: string; url?: string }>> };
export type ReplyKeyboard = { keyboard: string[][]; resize_keyboard: boolean; is_persistent: boolean; one_time_keyboard?: boolean };

/** Base (un-badged) labels for the persistent main menu. The webhook matches
 * incoming text against these via {@link stripTabBadge}, so we can safely
 * append a live "(N)" total without breaking routing. */
export const MAIN_TAB_LABELS = {
  intake: "📥 Intake",
  dispatch: "🗓️ Dispatch",
  liveops: "🛠️ Live ops",
  completion: "✅ Completion",
  finance: "💷 Finance",
  lookup: "🔎 Lookup",
  followups: "📌 Follow-ups",
} as const;

/** Which ACTION_COUNTERS feed each tab's total badge. Must stay in sync
 * with the `groups` map inside {@link tabInlineKeyboard}. */
const TAB_ACTION_KEYS: Record<TabKey, string[]> = {
  intake:     ["new_intake", "admin_attention"],
  dispatch:   ["to_assign", "todays_diary", "not_started"],
  liveops:    ["on_site", "to_call", "eng_unavail"],
  completion: ["awaiting_review", "to_close", "recent_closed"],
  finance:    ["expenses"],
  lookup:     [],
  followups:  ["followups"],
};

/** Strip a trailing " (123)" badge from a Telegram reply-keyboard label so
 * the webhook can match badged buttons back to their base tab key. */
export function stripTabBadge(text: string): string {
  return text.replace(/\s*\(\d+\)\s*$/, "").trim();
}

export async function mainReplyKeyboard(): Promise<ReplyKeyboard> {
  // Collect every counter referenced by any tab, run them once in parallel,
  // then sum per tab. Keeps the menu render to a single round-trip.
  const allKeys = Array.from(
    new Set(Object.values(TAB_ACTION_KEYS).flat()),
  );
  const counts = await resolveCounts(allKeys);
  const totalFor = (tab: TabKey): number | null => {
    const keys = TAB_ACTION_KEYS[tab];
    if (keys.length === 0) return null;
    let sum = 0;
    let anyKnown = false;
    for (const k of keys) {
      const v = counts[k];
      if (typeof v === "number") { sum += v; anyKnown = true; }
    }
    return anyKnown ? sum : null;
  };
  const label = (tab: TabKey): string => {
    const base = MAIN_TAB_LABELS[tab];
    const n = totalFor(tab);
    return n == null ? base : `${base} (${n})`;
  };
  return {
    keyboard: [
      [label("intake"), label("dispatch")],
      [label("liveops"), label("completion")],
      [label("finance"), label("lookup")],
      [label("followups"), "📧 Emails"],
      ["ℹ️ Menu", "🙈 Hide menu"],
    ],
    resize_keyboard: true,
    is_persistent: true,
  };
}

type TabKey = "intake" | "dispatch" | "liveops" | "completion" | "finance" | "lookup" | "followups";

/* ---------- Live counts ----------
 * Each entry mirrors the filter used by the matching action handler so the
 * badge shown next to a button label is always consistent with the list
 * that opens when the button is tapped. Count-only queries (head: true)
 * keep the menu cheap to render.
 */
const ACTION_COUNTERS: Record<string, () => Promise<number>> = {
  to_call: async () => {
    const { count } = await supabaseAdmin
      .from("work_orders").select("id", { count: "exact", head: true })
      .in("current_status", ["admin_attention", "awaiting_client_confirmation"]);
    return count ?? 0;
  },
  to_assign: async () => {
    const { count } = await supabaseAdmin
      .from("work_orders").select("id", { count: "exact", head: true })
      .in("current_status", ["ready_for_dispatch", "parsed_ready", "categorized"]);
    return count ?? 0;
  },
  to_close: async () => {
    const { count } = await supabaseAdmin
      .from("work_orders").select("id", { count: "exact", head: true })
      .in("current_status", ["field_submitted_complete", "field_submitted_incomplete", "dispatcher_review", "follow_up_required"]);
    return count ?? 0;
  },
  on_site: async () => {
    const { count } = await supabaseAdmin
      .from("work_orders").select("id", { count: "exact", head: true })
      .in("current_status", ["en_route", "on_site", "field_in_progress"]);
    return count ?? 0;
  },
  not_started: async () => {
    const { dateStr } = todayBounds();
    const { count } = await supabaseAdmin
      .from("work_orders").select("id", { count: "exact", head: true })
      .eq("diary_date", dateStr)
      .in("current_status", ["assigned", "accepted", "scheduled_in_sheet", "ready_for_dispatch"]);
    return count ?? 0;
  },
  awaiting_review: async () => {
    const { count } = await supabaseAdmin
      .from("work_orders").select("id", { count: "exact", head: true })
      .in("current_status", ["field_submitted_complete", "field_submitted_incomplete", "dispatcher_review"]);
    return count ?? 0;
  },
  admin_attention: async () => {
    const { count } = await supabaseAdmin
      .from("work_orders").select("id", { count: "exact", head: true })
      .eq("current_status", "admin_attention");
    return count ?? 0;
  },
  recent_closed: async () => {
    const { count } = await supabaseAdmin
      .from("work_orders").select("id", { count: "exact", head: true })
      .eq("current_status", "closed");
    return count ?? 0;
  },
  todays_diary: async () => {
    const { dateStr } = todayBounds();
    const { count } = await supabaseAdmin
      .from("work_orders").select("id", { count: "exact", head: true })
      .eq("diary_date", dateStr);
    return count ?? 0;
  },
  new_intake: async () => {
    const { count } = await supabaseAdmin
      .from("intake_records").select("id", { count: "exact", head: true })
      .is("converted_work_order_id", null)
      .neq("parse_status", "rejected");
    return count ?? 0;
  },
  eng_unavail: async () => {
    const { startIso, endIso } = todayBounds();
    const { count } = await supabaseAdmin
      .from("engineer_availability").select("id", { count: "exact", head: true })
      .in("availability_type", ["time_off", "unavailable_block"])
      .lte("start_at", endIso).gte("end_at", startIso);
    return count ?? 0;
  },
  expenses: async () => {
    const { count } = await supabaseAdmin
      .from("work_order_expenses").select("id", { count: "exact", head: true })
      .eq("payment_status", "pending");
    return count ?? 0;
  },
  followups: async () => {
    const { count } = await supabaseAdmin
      .from("telegram_followups").select("id", { count: "exact", head: true })
      .eq("status", "open");
    return count ?? 0;
  },
};

/** Resolve counts for a set of action keys in parallel. Failures degrade
 * gracefully — a key that errors simply gets no badge instead of breaking
 * the whole menu. */
async function resolveCounts(keys: string[]): Promise<Record<string, number | null>> {
  const out: Record<string, number | null> = {};
  await Promise.all(
    keys.map(async (k) => {
      const fn = ACTION_COUNTERS[k];
      if (!fn) { out[k] = null; return; }
      try { out[k] = await fn(); } catch { out[k] = null; }
    }),
  );
  return out;
}

export async function tabInlineKeyboard(tab: TabKey): Promise<InlineKeyboard> {
  const groups: Record<TabKey, Array<Array<[string, string]>>> = {
    intake: [
      [["📨 New intake to review", "act:new_intake:0"]],
      [["⚠️ Admin attention", "act:admin_attention:0"]],
    ],
    dispatch: [
      [["👷 Outstanding to assign", "act:to_assign:0"]],
      [["📅 Today's diary", "act:todays_diary:0"]],
      [["⏰ Not started today", "act:not_started:0"]],
    ],
    liveops: [
      [["🛠️ Jobs on site now", "act:on_site:0"]],
      [["📞 Outstanding to call", "act:to_call:0"]],
      [["🚫 Engineers unavailable today", "act:eng_unavail:0"]],
    ],
    completion: [
      [["📝 Awaiting dispatcher review", "act:awaiting_review:0"]],
      [["📦 Outstanding to close", "act:to_close:0"]],
      [["✅ Recently closed", "act:recent_closed:0"]],
    ],
    finance: [
      [["💷 Expenses awaiting review", "act:expenses:0"]],
    ],
    lookup: [
      [["🔎 Search work order", "act:help_wo:0"]],
      [["🧑 Search engineer", "act:help_eng:0"]],
      [["🏢 Search client/contact", "act:help_contact:0"]],
    ],
    followups: [
      [["📌 Open follow-ups", "act:followups:0"]],
    ],
  };
  const rows = groups[tab];
  // Pull every action key on this tab so we can decorate labels with a
  // live "(N)" badge that matches the list the button opens.
  const keys: string[] = [];
  for (const row of rows) for (const [, data] of row) {
    // callback_data shape is `act:<key>:<page>`
    const k = data.split(":")[1];
    if (k && ACTION_COUNTERS[k]) keys.push(k);
  }
  const counts = await resolveCounts(keys);
  return {
    inline_keyboard: rows.map((row) =>
      row.map(([text, data]) => {
        const k = data.split(":")[1];
        const c = k ? counts[k] : undefined;
        const label = c == null ? text : `${text} (${c})`;
        return { text: label, callback_data: data };
      }),
    ),
  };
}

function paginationKeyboard(key: string, page: number, hasMore: boolean): InlineKeyboard {
  const row: Array<{ text: string; callback_data: string }> = [];
  if (page > 0) row.push({ text: "« Prev", callback_data: `act:${key}:${page - 1}` });
  row.push({ text: "🔄 Refresh", callback_data: `act:${key}:${page}` });
  if (hasMore) row.push({ text: "Next »", callback_data: `act:${key}:${page + 1}` });
  return { inline_keyboard: [row] };
}

/** Build a list keyboard with per-item PDF/Actions buttons plus pagination. */
function woListKeyboard(
  rows: Array<{ id: string }>,
  key: string,
  page: number,
  hasMore: boolean,
): InlineKeyboard {
  const ik: Array<Array<{ text: string; callback_data: string }>> = [];
  rows.forEach((r, i) => {
    const n = page * PAGE_SIZE + i + 1;
    ik.push([
      { text: `#${n} 📄 PDF`, callback_data: `wo:pdf:${r.id}` },
      { text: `#${n} ⚙️ Actions`, callback_data: `wo:menu:${r.id}` },
    ]);
  });
  for (const row of paginationKeyboard(key, page, hasMore).inline_keyboard) {
    ik.push(row.map((b) => ({ text: b.text, callback_data: b.callback_data ?? "" })));
  }
  return { inline_keyboard: ik };
}

// ---------- formatters ----------

type WoRow = {
  id: string;
  order_no: string | null;
  job_summary: string | null;
  current_status: string | null;
  priority_level: string | null;
  diary_date: string | null;
  scheduled_start_at: string | null;
  postcode: string | null;
  postcode_zone: string | null;
  address_line_1: string | null;
  tenant_name: string | null;
  tenant_phone: string | null;
  client_id: string | null;
  clients?: { client_name: string | null } | null;
};

function formatTime(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleString("en-GB", { weekday: "short", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Europe/London" });
}
function formatDate(s: string | null): string {
  if (!s) return "";
  const d = new Date(s + "T00:00:00Z");
  return d.toLocaleDateString("en-GB", { weekday: "short", day: "2-digit", month: "short", timeZone: "Europe/London" });
}

async function attachAssignments(rows: WoRow[]): Promise<Map<string, string>> {
  if (rows.length === 0) return new Map();
  const ids = rows.map((r) => r.id);
  const { data } = await supabaseAdmin
    .from("work_order_assignments")
    .select("work_order_id, assignment_role, assignment_status, engineers(display_name)")
    .in("work_order_id", ids)
    .in("assignment_status", ["assigned", "accepted"]);
  const map = new Map<string, string[]>();
  for (const r of (data ?? []) as Array<{ work_order_id: string; assignment_role: string; engineers: { display_name: string } | null }>) {
    const name = r.engineers?.display_name ?? "?";
    const tag = r.assignment_role === "lead" ? `${name}` : `+${name}`;
    const list = map.get(r.work_order_id) ?? [];
    list.push(tag);
    map.set(r.work_order_id, list);
  }
  const out = new Map<string, string>();
  for (const [k, v] of map) out.set(k, v.join(", "));
  return out;
}

function formatWoLine(r: WoRow, idx: number, eng?: string): string {
  const ref = escapeHtml(r.order_no ?? "(no ref)");
  const summary = escapeHtml((r.job_summary ?? "—").slice(0, 80));
  const client = escapeHtml(r.clients?.client_name ?? "");
  const addr = escapeHtml([r.address_line_1, r.postcode].filter(Boolean).join(", ").slice(0, 60));
  const tenant = escapeHtml(r.tenant_name ?? "");
  const when = r.scheduled_start_at ? formatTime(r.scheduled_start_at) : r.diary_date ? formatDate(r.diary_date) : "";
  const lines = [
    `<b>${idx}. ${ref}</b> ${priorityIcon(r.priority_level)} · <i>${escapeHtml(statusShort(r.current_status))}</i>`,
    summary,
  ];
  const meta: string[] = [];
  if (client) meta.push(`🏢 ${client}`);
  if (tenant) meta.push(`👤 ${tenant}`);
  if (addr) meta.push(`📍 ${addr}`);
  if (eng) meta.push(`🧑 ${escapeHtml(eng)}`);
  if (when) meta.push(`🗓️ ${escapeHtml(when)}`);
  if (meta.length) lines.push(meta.join(" · "));
  return lines.join("\n");
}

function header(title: string, count: number, page: number, totalShown: number): string {
  const range = totalShown > 0 ? ` · showing ${page * PAGE_SIZE + 1}–${page * PAGE_SIZE + totalShown}` : "";
  return `<b>${escapeHtml(title)}</b>\nTotal: ${count}${range}`;
}

const WO_SELECT = "id, order_no, job_summary, current_status, priority_level, diary_date, scheduled_start_at, postcode, postcode_zone, address_line_1, tenant_name, tenant_phone, client_id, clients(client_name)";

// ---------- action handlers ----------

export type ActionResult = { text: string; reply_markup?: InlineKeyboard };

async function listWorkOrders(opts: {
  title: string;
  key: string;
  page: number;
  build: (q: ReturnType<typeof supabaseAdmin.from> extends infer T ? any : never) => any;
}): Promise<ActionResult> {
  const from = opts.page * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;
  const baseCount = opts.build(supabaseAdmin.from("work_orders").select("id", { count: "exact", head: true }));
  const baseRows = opts.build(supabaseAdmin.from("work_orders").select(WO_SELECT)).range(from, to);

  const [{ count }, { data, error }] = await Promise.all([baseCount, baseRows]);
  if (error) return { text: `<b>${escapeHtml(opts.title)}</b>\n❌ ${escapeHtml(error.message)}` };

  const rows = (data ?? []) as unknown as WoRow[];
  if (rows.length === 0) {
    return { text: `<b>${escapeHtml(opts.title)}</b>\n✅ Nothing here right now.` };
  }
  const engMap = await attachAssignments(rows);
  const lines = rows.map((r, i) => formatWoLine(r, opts.page * PAGE_SIZE + i + 1, engMap.get(r.id)));
  const total = count ?? rows.length;
  const hasMore = total > (opts.page + 1) * PAGE_SIZE;
  return {
    text: [header(opts.title, total, opts.page, rows.length), "", lines.join("\n\n")].join("\n"),
    reply_markup: woListKeyboard(rows, opts.key, opts.page, hasMore),
  };
}

// each action: (page) => Promise<ActionResult>
export const actions: Record<string, (page: number) => Promise<ActionResult>> = {
  to_call: (page) =>
    listWorkOrders({
      title: "📞 Outstanding to call",
      key: "to_call",
      page,
      build: (q) =>
        q.in("current_status", ["admin_attention", "awaiting_client_confirmation"]).order("priority_level", { ascending: false }).order("created_at", { ascending: true }),
    }),

  to_assign: (page) =>
    listWorkOrders({
      title: "👷 Outstanding to assign to engineer",
      key: "to_assign",
      page,
      build: (q) =>
        q.in("current_status", ["ready_for_dispatch", "parsed_ready", "categorized"]).order("priority_level", { ascending: false }).order("created_at", { ascending: true }),
    }),

  to_close: (page) =>
    listWorkOrders({
      title: "📦 Outstanding to close",
      key: "to_close",
      page,
      build: (q) =>
        q.in("current_status", ["field_submitted_complete", "field_submitted_incomplete", "dispatcher_review", "follow_up_required"]).order("updated_at", { ascending: true }),
    }),

  new_intake: async (page) => {
    const from = page * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;
    const [{ count }, { data, error }] = await Promise.all([
      supabaseAdmin.from("intake_records").select("id", { count: "exact", head: true }).is("converted_work_order_id", null).neq("parse_status", "rejected"),
      supabaseAdmin
        .from("intake_records")
        .select("id, source_reference, source_sender, source_subject, source_type, received_at, parse_status, parse_confidence, extracted_fields_json, missing_fields_json, created_at")
        .is("converted_work_order_id", null)
        .neq("parse_status", "rejected")
        .order("created_at", { ascending: false })
        .range(from, to),
    ]);
    if (error) return { text: `❌ ${escapeHtml(error.message)}` };
    const rows = (data ?? []) as Array<{
      id: string; source_reference: string | null; source_sender: string | null; source_subject: string | null;
      source_type: string | null; received_at: string | null; parse_status: string; parse_confidence: number | null;
      extracted_fields_json: Record<string, unknown>; missing_fields_json: unknown; created_at: string;
    }>;
    if (rows.length === 0) return { text: `<b>📨 New intake to review</b>\n✅ Inbox is clear.` };
    const STATUS_BADGE: Record<string, string> = {
      received: "🆕",
      parsing: "⏳",
      parsed: "📝",
      needs_review: "🟡",
      duplicate_suspected: "♻️",
      parse_failed: "🛑",
      categorized: "✅",
      awaiting_client_confirmation: "📞",
    };
    const lines = rows.map((r, i) => {
      const f = (r.extracted_fields_json ?? {}) as Record<string, string | null>;
      const missing = Array.isArray(r.missing_fields_json) ? (r.missing_fields_json as string[]) : [];
      const conf = r.parse_confidence != null ? `${Math.round(r.parse_confidence * 100)}%` : "—";
      const badge = STATUS_BADGE[r.parse_status] ?? "📨";
      const n = page * PAGE_SIZE + i + 1;
      const subject = (r.source_subject ?? f.subject ?? f.issue_summary ?? "Intake item").toString().slice(0, 90);
      const sender = (r.source_sender ?? f.agent_email ?? "").toString().slice(0, 80);
      const agency = (f.agency_name ?? f.client_name ?? "").toString().slice(0, 60);
      const phone = (f.contact_phone ?? f.tenant_phone ?? "").toString().slice(0, 24);
      const orderNo = (f.order_no ?? "").toString().slice(0, 30);
      const where = [f.postcode, f.address_line_1].filter(Boolean).join(", ").slice(0, 80);
      const when = r.received_at ? new Date(r.received_at).toLocaleString("en-GB", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "short" }) : "";
      const missingLine = missing.length ? `⚠️ Missing: ${missing.slice(0, 4).join(", ")}${missing.length > 4 ? "…" : ""}` : "";
      return [
        `<b>${n}. ${badge} ${escapeHtml(subject)}</b>`,
        `<i>${escapeHtml(r.parse_status)} · conf ${conf}${when ? " · " + escapeHtml(when) : ""}</i>`,
        agency ? `🏢 <b>${escapeHtml(agency)}</b>` : "",
        sender ? `✉️ ${escapeHtml(sender)}` : "",
        phone ? `📞 ${escapeHtml(phone)}` : "",
        orderNo ? `🏷 Ref ${escapeHtml(orderNo)}` : "",
        where ? `📍 ${escapeHtml(where)}` : "",
        missingLine ? escapeHtml(missingLine) : "",
      ].filter(Boolean).join("\n");
    });
    const total = count ?? rows.length;
    const baseKb = paginationKeyboard("new_intake", page, total > (page + 1) * PAGE_SIZE);
    const itemRows: Array<Array<{ text: string; url?: string; callback_data?: string }>> = rows.map((r, i) => {
      const n = page * PAGE_SIZE + i + 1;
      const f = (r.extracted_fields_json ?? {}) as Record<string, string | null>;
      const row: Array<{ text: string; url?: string; callback_data?: string }> = [
        { text: `#${n} 📂 Open`, url: `${APP_BASE}/admin/intake?focus=${r.id}` },
      ];
      const sender = r.source_sender ?? f.agent_email ?? "";
      if (sender) {
        const subject = encodeURIComponent(`Re: ${r.source_subject ?? "Work order"} — additional details required`);
        row.push({ text: "✉️ Reply", url: `mailto:${sender}?subject=${subject}` });
      }
      const phone = (f.contact_phone ?? f.tenant_phone ?? "").toString().replace(/[^\d+]/g, "");
      if (phone) row.push({ text: "📞 Call", url: `tel:${phone}` });
      return row;
    });
    const inline_keyboard = [...itemRows, ...baseKb.inline_keyboard];
    return {
      text: [header("📨 New intake to review", total, page, rows.length), "", lines.join("\n\n")].join("\n"),
      reply_markup: { inline_keyboard } as InlineKeyboard,
    };
  },

  on_site: (page) =>
    listWorkOrders({
      title: "🛠️ Jobs on site now",
      key: "on_site",
      page,
      build: (q) => q.in("current_status", ["en_route", "on_site", "field_in_progress"]).order("scheduled_start_at", { ascending: true }),
    }),

  not_started: (page) => {
    const { dateStr } = todayBounds();
    return listWorkOrders({
      title: "⏰ Not started today",
      key: "not_started",
      page,
      build: (q) =>
        q.eq("diary_date", dateStr).in("current_status", ["assigned", "accepted", "scheduled_in_sheet", "ready_for_dispatch"]).order("scheduled_start_at", { ascending: true }),
    });
  },

  awaiting_review: (page) =>
    listWorkOrders({
      title: "📝 Awaiting dispatcher review",
      key: "awaiting_review",
      page,
      build: (q) => q.in("current_status", ["field_submitted_complete", "field_submitted_incomplete", "dispatcher_review"]).order("updated_at", { ascending: true }),
    }),

  eng_unavail: async (page) => {
    const { startIso, endIso } = todayBounds();
    const from = page * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;
    const baseQ = supabaseAdmin
      .from("engineer_availability")
      .select("id, availability_type, start_at, end_at, note, engineers(display_name)", { count: "exact" })
      .in("availability_type", ["time_off", "unavailable_block"])
      .lte("start_at", endIso)
      .gte("end_at", startIso)
      .order("start_at", { ascending: true })
      .range(from, to);
    const { data, error, count } = await baseQ;
    if (error) return { text: `❌ ${escapeHtml(error.message)}` };
    const rows = (data ?? []) as Array<{ id: string; availability_type: string; start_at: string; end_at: string; note: string | null; engineers: { display_name: string } | null }>;
    if (rows.length === 0) return { text: "<b>🚫 Engineers unavailable today</b>\n✅ Everyone is available." };
    const lines = rows.map((r, i) =>
      `<b>${page * PAGE_SIZE + i + 1}. ${escapeHtml(r.engineers?.display_name ?? "Engineer")}</b>\n` +
      `${escapeHtml(r.availability_type)} · ${escapeHtml(formatTime(r.start_at))} → ${escapeHtml(formatTime(r.end_at))}` +
      (r.note ? `\n📝 ${escapeHtml(r.note)}` : ""),
    );
    const total = count ?? rows.length;
    return {
      text: [header("🚫 Engineers unavailable today", total, page, rows.length), "", lines.join("\n\n")].join("\n"),
      reply_markup: paginationKeyboard("eng_unavail", page, total > (page + 1) * PAGE_SIZE),
    };
  },

  expenses: async (page) => {
    const from = page * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;
    const { data, error, count } = await supabaseAdmin
      .from("work_order_expenses")
      .select("id, amount, vendor, expense_type, created_at, work_order_id", { count: "exact" })
      .eq("payment_status", "pending")
      .order("created_at", { ascending: false })
      .range(from, to);
    if (error) return { text: `❌ ${escapeHtml(error.message)}` };
    const rawRows = (data ?? []) as Array<{ id: string; amount: number; vendor: string | null; expense_type: string; created_at: string; work_order_id: string }>;
    const woIds = rawRows.map((r) => r.work_order_id);
    const { data: wos } = woIds.length
      ? await supabaseAdmin.from("work_orders").select("id, order_no, job_summary").in("id", woIds)
      : { data: [] as Array<{ id: string; order_no: string | null; job_summary: string | null }> };
    const woMap = new Map((wos ?? []).map((w) => [w.id, w] as const));
    const rows = rawRows.map((r) => ({ ...r, work_orders: woMap.get(r.work_order_id) ?? null }));
    if (rows.length === 0) return { text: "<b>💷 Expenses awaiting review</b>\n✅ Nothing pending." };
    const lines = rows.map((r, i) =>
      `<b>${page * PAGE_SIZE + i + 1}. £${Number(r.amount).toFixed(2)}</b> · ${escapeHtml(r.expense_type)}\n` +
      `${escapeHtml(r.vendor ?? "—")}\n` +
      `🧾 ${escapeHtml(r.work_orders?.order_no ?? "")} · ${escapeHtml((r.work_orders?.job_summary ?? "").slice(0, 60))}`,
    );
    const total = count ?? rows.length;
    return {
      text: [header("💷 Expenses awaiting review", total, page, rows.length), "", lines.join("\n\n")].join("\n"),
      reply_markup: paginationKeyboard("expenses", page, total > (page + 1) * PAGE_SIZE),
    };
  },

  admin_attention: (page) =>
    listWorkOrders({
      title: "⚠️ Admin attention",
      key: "admin_attention",
      page,
      build: (q) => q.eq("current_status", "admin_attention").order("created_at", { ascending: true }),
    }),

  recent_closed: (page) =>
    listWorkOrders({
      title: "✅ Recently closed jobs",
      key: "recent_closed",
      page,
      build: (q) => q.eq("current_status", "closed").order("updated_at", { ascending: false }),
    }),

  todays_diary: (page) => {
    const { dateStr } = todayBounds();
    return listWorkOrders({
      title: `📅 Today's diary (${dateStr})`,
      key: "todays_diary",
      page,
      build: (q) => q.eq("diary_date", dateStr).order("scheduled_start_at", { ascending: true, nullsFirst: false }),
    });
  },

  help_wo: async () => ({
    text:
      "🔎 <b>Search work order</b>\nReply with:\n<code>/wo &lt;order no or text&gt;</code>\nExample: <code>/wo WO-2026-00012</code> or <code>/wo boiler camden</code>",
  }),
  help_eng: async () => ({
    text: "🧑 <b>Search engineer</b>\nReply with:\n<code>/eng &lt;name&gt;</code>",
  }),
  help_contact: async () => ({
    text: "🏢 <b>Search client/contact</b>\nReply with:\n<code>/contact &lt;name, email or phone&gt;</code>",
  }),

  followups: async (page) => {
    const from = page * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;
    const { data, error, count } = await supabaseAdmin
      .from("telegram_followups")
      .select("id, followup_type, sender_value, sender_name, preview, source_reference, created_at", { count: "exact" })
      .eq("status", "open")
      .order("created_at", { ascending: false })
      .range(from, to);
    if (error) return { text: `❌ ${escapeHtml(error.message)}` };
    const rows = (data ?? []) as Array<{ id: string; followup_type: string; sender_value: string; sender_name: string | null; preview: string | null; source_reference: string | null; created_at: string }>;
    if (rows.length === 0) return { text: "<b>📌 Open follow-ups</b>\n✅ No open follow-ups." };
    const total = count ?? rows.length;
    const text =
      header("📌 Open follow-ups — new senders to file", total, page, rows.length) +
      "\n\n" +
      rows.map((r, i) =>
        `<b>${page * PAGE_SIZE + i + 1}. ${escapeHtml(r.sender_name ?? r.sender_value)}</b>\n` +
        `${r.followup_type === "unknown_email_sender" ? "📧" : "📱"} <code>${escapeHtml(r.sender_value)}</code>` +
        (r.preview ? `\n📝 ${escapeHtml(r.preview.slice(0, 120))}` : "") +
        `\nTap below to file.`,
      ).join("\n\n");
    // Build per-item inline buttons
    const inline_keyboard: Array<Array<{ text: string; callback_data: string }>> = [];
    rows.forEach((r, i) => {
      const n = page * PAGE_SIZE + i + 1;
      inline_keyboard.push([
        { text: `#${n} Client`, callback_data: `fu:client:${r.id}` },
        { text: `Agency`, callback_data: `fu:agency:${r.id}` },
        { text: `Contact`, callback_data: `fu:contact:${r.id}` },
        { text: `Ignore`, callback_data: `fu:ignore:${r.id}` },
      ]);
    });
    const pag = paginationKeyboard("followups", page, total > (page + 1) * PAGE_SIZE);
    for (const row of pag.inline_keyboard) {
      inline_keyboard.push(row.map((b) => ({ text: b.text, callback_data: b.callback_data ?? "" })));
    }
    return { text, reply_markup: { inline_keyboard } };
  },
};

// ---------- search ----------

export async function searchWorkOrder(q: string): Promise<ActionResult> {
  const term = q.trim();
  if (!term) return { text: "Provide search text after /wo." };
  const { data, error } = await supabaseAdmin
    .from("work_orders")
    .select(WO_SELECT)
    .or(`order_no.ilike.%${term}%,job_summary.ilike.%${term}%,address_line_1.ilike.%${term}%,postcode.ilike.%${term}%`)
    .order("updated_at", { ascending: false })
    .limit(10);
  if (error) return { text: `❌ ${escapeHtml(error.message)}` };
  const rows = (data ?? []) as unknown as WoRow[];
  if (rows.length === 0) return { text: `🔎 No work orders match "${escapeHtml(term)}".` };
  const engMap = await attachAssignments(rows);
  const lines = rows.map((r, i) => formatWoLine(r, i + 1, engMap.get(r.id)));
  return {
    text: `<b>🔎 Work order results for "${escapeHtml(term)}"</b>\n\n${lines.join("\n\n")}`,
    reply_markup: woListKeyboard(rows, "search", 0, false),
  };
}

export async function searchEngineer(q: string): Promise<ActionResult> {
  const term = q.trim();
  if (!term) return { text: "Provide name after /eng." };
  const { data, error } = await supabaseAdmin
    .from("engineers")
    .select("id, display_name, engineer_code, trade_tags, active_status")
    .or(`display_name.ilike.%${term}%,engineer_code.ilike.%${term}%`)
    .limit(10);
  if (error) return { text: `❌ ${escapeHtml(error.message)}` };
  const rows = (data ?? []) as Array<{ id: string; display_name: string; engineer_code: string | null; trade_tags: string[]; active_status: boolean }>;
  if (rows.length === 0) return { text: `🧑 No engineers match "${escapeHtml(term)}".` };
  const lines = rows.map((r, i) =>
    `<b>${i + 1}. ${escapeHtml(r.display_name)}</b> ${r.active_status ? "🟢" : "⚪"}\n` +
    `code: ${escapeHtml(r.engineer_code ?? "—")} · trades: ${escapeHtml((r.trade_tags ?? []).join(", "))}`,
  );
  return { text: `<b>🧑 Engineer results for "${escapeHtml(term)}"</b>\n\n${lines.join("\n\n")}` };
}

export async function searchContact(q: string): Promise<ActionResult> {
  const term = q.trim();
  if (!term) return { text: "Provide search text after /contact." };
  const [{ data: clients }, { data: contacts }] = await Promise.all([
    supabaseAdmin.from("clients").select("id, client_name, client_type, contact_name, contact_email, contact_phone").or(`client_name.ilike.%${term}%,contact_name.ilike.%${term}%,contact_email.ilike.%${term}%,contact_phone.ilike.%${term}%`).limit(8),
    supabaseAdmin.from("external_contacts").select("id, name, organization, role_label, email, phone").or(`name.ilike.%${term}%,organization.ilike.%${term}%,email.ilike.%${term}%,phone.ilike.%${term}%`).limit(8),
  ]);
  const clientLines = (clients ?? []).map((c, i) =>
    `<b>${i + 1}. ${escapeHtml(c.client_name)}</b> (${escapeHtml(c.client_type)})\n` +
    `${escapeHtml(c.contact_name ?? "")} · ${escapeHtml(c.contact_email ?? "")} · ${escapeHtml(c.contact_phone ?? "")}`,
  );
  const contactLines = (contacts ?? []).map((c, i) =>
    `<b>${i + 1}. ${escapeHtml(c.name)}</b>\n` +
    `${escapeHtml(c.organization ?? "")} · ${escapeHtml(c.email ?? "")} · ${escapeHtml(c.phone ?? "")}`,
  );
  if (!clientLines.length && !contactLines.length) return { text: `🏢 No matches for "${escapeHtml(term)}".` };
  const parts = [`<b>🔎 Contact results for "${escapeHtml(term)}"</b>`];
  if (clientLines.length) parts.push("\n<b>Clients</b>\n" + clientLines.join("\n\n"));
  if (contactLines.length) parts.push("\n<b>External contacts</b>\n" + contactLines.join("\n\n"));
  return { text: parts.join("\n") };
}

// ---------- follow-up actions ----------

export async function resolveFollowup(args: { id: string; action: "client" | "agency" | "contact" | "ignore"; actorProfileId: string | null }): Promise<ActionResult> {
  const { data: fu, error } = await supabaseAdmin
    .from("telegram_followups")
    .select("id, followup_type, sender_value, sender_name, preview")
    .eq("id", args.id)
    .maybeSingle();
  if (error || !fu) return { text: "❌ Follow-up not found." };
  if (args.action === "ignore") {
    await supabaseAdmin
      .from("telegram_followups")
      .update({ status: "ignored", resolved_at: new Date().toISOString(), resolved_by: args.actorProfileId, resolved_action: "ignore" })
      .eq("id", args.id);
    return { text: `🗑️ Ignored sender <code>${escapeHtml(fu.sender_value)}</code>.` };
  }

  if (args.action === "client" || args.action === "agency") {
    const isEmail = fu.followup_type === "unknown_email_sender";
    const { data: inserted, error: insErr } = await supabaseAdmin
      .from("clients")
      .insert({
        client_name: fu.sender_name ?? fu.sender_value,
        client_type: args.action === "agency" ? "agency" : "private",
        contact_email: isEmail ? fu.sender_value : null,
        contact_phone: !isEmail ? fu.sender_value : null,
      } as never)
      .select("id")
      .single();
    if (insErr) return { text: `❌ ${escapeHtml(insErr.message)}` };
    await supabaseAdmin
      .from("telegram_followups")
      .update({ status: "resolved", resolved_at: new Date().toISOString(), resolved_by: args.actorProfileId, resolved_action: `add_${args.action}`, resolved_target_id: inserted.id })
      .eq("id", args.id);
    return { text: `✅ Added as ${args.action}: <b>${escapeHtml(fu.sender_name ?? fu.sender_value)}</b>` };
  }

  // contact
  const isEmail = fu.followup_type === "unknown_email_sender";
  const { data: inserted, error: insErr } = await supabaseAdmin
    .from("external_contacts")
    .insert({
      name: fu.sender_name ?? fu.sender_value,
      email: isEmail ? fu.sender_value : null,
      phone: !isEmail ? fu.sender_value : null,
      contact_type: "other",
    } as never)
    .select("id")
    .single();
  if (insErr) return { text: `❌ ${escapeHtml(insErr.message)}` };
  await supabaseAdmin
    .from("telegram_followups")
    .update({ status: "resolved", resolved_at: new Date().toISOString(), resolved_by: args.actorProfileId, resolved_action: "add_contact", resolved_target_id: inserted.id })
    .eq("id", args.id);
  return { text: `✅ Added contact: <b>${escapeHtml(fu.sender_name ?? fu.sender_value)}</b>` };
}

// ---------- new-sender scanner ----------

function extractEmail(addr: string | null | undefined): string | null {
  if (!addr) return null;
  const m = addr.match(/<([^>]+)>/);
  const e = (m ? m[1] : addr).trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+$/.test(e) ? e : null;
}
function extractName(addr: string | null | undefined, fromName: string | null | undefined): string | null {
  if (fromName?.trim()) return fromName.trim();
  if (!addr) return null;
  const m = addr.match(/^([^<]+)</);
  return m ? m[1].trim().replace(/^"|"$/g, "") : null;
}

export async function maybeCreateUnknownEmailFollowup(args: { fromAddress: string | null; fromName: string | null; subject: string | null; snippet: string | null }): Promise<void> {
  const email = extractEmail(args.fromAddress);
  if (!email) return;

  // already known?
  const [{ count: cClient }, { count: cContact }, { count: cExisting }] = await Promise.all([
    supabaseAdmin.from("clients").select("id", { count: "exact", head: true }).ilike("contact_email", email),
    supabaseAdmin.from("external_contacts").select("id", { count: "exact", head: true }).ilike("email", email),
    supabaseAdmin.from("telegram_followups").select("id", { count: "exact", head: true }).eq("followup_type", "unknown_email_sender").eq("sender_value", email),
  ]);
  if ((cClient ?? 0) > 0 || (cContact ?? 0) > 0 || (cExisting ?? 0) > 0) return;

  const name = extractName(args.fromAddress, args.fromName);
  await supabaseAdmin.from("telegram_followups").insert({
    followup_type: "unknown_email_sender",
    sender_value: email,
    sender_name: name,
    source_reference: args.subject ?? null,
    preview: args.snippet?.slice(0, 200) ?? null,
  } as never);
}

function normalisePhone(p: string | null | undefined): string | null {
  if (!p) return null;
  const digits = p.replace(/[^\d+]/g, "");
  if (digits.length < 7) return null;
  return digits;
}

export async function maybeCreateUnknownPhoneFollowup(args: { phone: string | null; name: string | null; sourceReference: string | null; preview: string | null; recordId?: string | null }): Promise<void> {
  const phone = normalisePhone(args.phone);
  if (!phone) return;
  const [{ count: cClient }, { count: cContact }, { count: cExisting }] = await Promise.all([
    supabaseAdmin.from("clients").select("id", { count: "exact", head: true }).ilike("contact_phone", `%${phone.slice(-7)}%`),
    supabaseAdmin.from("external_contacts").select("id", { count: "exact", head: true }).ilike("phone", `%${phone.slice(-7)}%`),
    supabaseAdmin.from("telegram_followups").select("id", { count: "exact", head: true }).eq("followup_type", "unknown_phone_sender").eq("sender_value", phone),
  ]);
  if ((cClient ?? 0) > 0 || (cContact ?? 0) > 0 || (cExisting ?? 0) > 0) return;
  await supabaseAdmin.from("telegram_followups").insert({
    followup_type: "unknown_phone_sender",
    sender_value: phone,
    sender_name: args.name,
    source_reference: args.sourceReference,
    source_record_type: "intake_record",
    source_record_id: args.recordId ?? null,
    preview: args.preview?.slice(0, 200) ?? null,
  } as never);
}

// ---------- Work-order detail / actions ----------

export type WoMessage =
  | { kind: "text"; text: string; reply_markup?: InlineKeyboard }
  | { kind: "pdf"; bytes: Uint8Array; filename: string; caption: string }
  | { kind: "doc_url"; url: string; caption: string };

function woActionKeyboard(id: string): InlineKeyboard {
  return {
    inline_keyboard: [
      [
        { text: "📄 Send PDF", callback_data: `wo:pdf:${id}` },
        { text: "📎 Source files", callback_data: `wo:files:${id}` },
      ],
      [
        { text: "📝 Mark for review", callback_data: `wo:review:${id}` },
        { text: "📞 Contact", callback_data: `wo:contact:${id}` },
      ],
      [
        { text: "🔁 Reassign", url: `${APP_BASE}/admin/work-orders/${id}?tab=assign` },
        { text: "🌐 Open in portal", url: `${APP_BASE}/admin/work-orders/${id}` },
      ],
    ],
  };
}

async function fetchWoSummary(id: string): Promise<WoRow | null> {
  const { data } = await supabaseAdmin
    .from("work_orders")
    .select(WO_SELECT)
    .eq("id", id)
    .maybeSingle();
  return (data as unknown as WoRow) ?? null;
}

export async function woAction(args: {
  action: string;
  id: string;
  actorProfileId: string;
}): Promise<WoMessage | WoMessage[]> {
  const { action, id, actorProfileId } = args;

  if (action === "menu") {
    const wo = await fetchWoSummary(id);
    if (!wo) return { kind: "text", text: "❌ Work order not found." };
    const engMap = await attachAssignments([wo]);
    const summary = formatWoLine(wo, 1, engMap.get(wo.id));
    return {
      kind: "text",
      text: `<b>Work order ${escapeHtml(wo.order_no ?? "")}</b>\n\n${summary}\n\nChoose an action:`,
      reply_markup: woActionKeyboard(id),
    };
  }

  if (action === "pdf") {
    const built = await buildWorkOrderPdf(id);
    if (!built) return { kind: "text", text: "❌ Could not build PDF for this work order." };
    return {
      kind: "pdf",
      bytes: built.bytes,
      filename: built.filename,
      caption: `📄 ${built.orderNo} — ${built.summary}`.slice(0, 1000),
    };
  }

  if (action === "files") {
    const wo = await fetchWoSummary(id);
    if (!wo) return { kind: "text", text: "❌ Work order not found." };
    const { data: files } = await supabaseAdmin
      .from("work_order_files")
      .select("id, file_kind, storage_bucket, storage_path, mime_type, uploaded_at")
      .eq("work_order_id", id)
      .order("uploaded_at", { ascending: false })
      .limit(10);
    const rows = (files ?? []) as Array<{
      id: string; file_kind: string; storage_bucket: string; storage_path: string;
      mime_type: string | null; uploaded_at: string;
    }>;
    if (rows.length === 0) {
      return { kind: "text", text: `📎 <b>${escapeHtml(wo.order_no ?? "")}</b>\nNo source files attached.` };
    }
    const out: WoMessage[] = [
      { kind: "text", text: `📎 <b>${escapeHtml(wo.order_no ?? "")}</b> — sending ${rows.length} file(s)…` },
    ];
    for (const f of rows) {
      const { data: signed } = await supabaseAdmin.storage
        .from(f.storage_bucket)
        .createSignedUrl(f.storage_path, 60 * 30);
      if (!signed?.signedUrl) continue;
      const name = f.storage_path.split("/").pop() ?? "file";
      out.push({
        kind: "doc_url",
        url: signed.signedUrl,
        caption: `${f.file_kind} · ${name}`.slice(0, 1000),
      });
    }
    return out;
  }

  if (action === "review") {
    const { error } = await supabaseAdmin
      .from("work_orders")
      .update({ current_status: "dispatcher_review" } as never)
      .eq("id", id);
    if (error) return { kind: "text", text: `❌ ${escapeHtml(error.message)}` };
    void actorProfileId;
    const wo = await fetchWoSummary(id);
    return {
      kind: "text",
      text: `📝 Marked <b>${escapeHtml(wo?.order_no ?? id)}</b> for dispatcher review.`,
      reply_markup: woActionKeyboard(id),
    };
  }

  if (action === "contact") {
    const wo = await fetchWoSummary(id);
    if (!wo) return { kind: "text", text: "❌ Work order not found." };
    let clientPhone: string | null = null;
    let clientEmail: string | null = null;
    if (wo.client_id) {
      const { data: c } = await supabaseAdmin
        .from("clients")
        .select("contact_phone, contact_email")
        .eq("id", wo.client_id)
        .maybeSingle();
      clientPhone = (c as { contact_phone: string | null } | null)?.contact_phone ?? null;
      clientEmail = (c as { contact_email: string | null } | null)?.contact_email ?? null;
    }
    const lines = [`📞 <b>Contacts — ${escapeHtml(wo.order_no ?? "")}</b>`];
    if (wo.tenant_name || wo.tenant_phone) {
      lines.push(`👤 Tenant: ${escapeHtml(wo.tenant_name ?? "—")}` + (wo.tenant_phone ? ` · <a href="tel:${escapeHtml(wo.tenant_phone)}">${escapeHtml(wo.tenant_phone)}</a>` : ""));
    }
    if (wo.clients?.client_name || clientPhone || clientEmail) {
      lines.push(
        `🏢 Client: ${escapeHtml(wo.clients?.client_name ?? "—")}` +
          (clientPhone ? ` · <a href="tel:${escapeHtml(clientPhone)}">${escapeHtml(clientPhone)}</a>` : "") +
          (clientEmail ? ` · <a href="mailto:${escapeHtml(clientEmail)}">${escapeHtml(clientEmail)}</a>` : ""),
      );
    }
    if (lines.length === 1) lines.push("No contact details on file.");
    return { kind: "text", text: lines.join("\n"), reply_markup: woActionKeyboard(id) };
  }

  return { kind: "text", text: `Unknown work-order action: ${escapeHtml(action)}` };
}