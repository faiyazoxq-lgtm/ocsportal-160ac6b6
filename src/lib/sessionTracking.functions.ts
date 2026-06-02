import { createServerFn } from "@tanstack/react-start";
import { getRequestHeaders, getRequestIP } from "@tanstack/react-start/server";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  editTelegramMessageCaption,
  editTelegramMessageText,
  sendTelegramDocument,
  sendTelegramMessage,
} from "@/services/telegramSend.server";

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function parseUserAgent(ua: string): { browser: string; os: string; device: string } {
  const browser =
    /Edg\/[\d.]+/.exec(ua)?.[0]?.replace("/", " ") ??
    /OPR\/[\d.]+/.exec(ua)?.[0]?.replace("/", " ") ??
    /Chrome\/[\d.]+/.exec(ua)?.[0]?.replace("/", " ") ??
    /Firefox\/[\d.]+/.exec(ua)?.[0]?.replace("/", " ") ??
    /Safari\/[\d.]+/.exec(ua)?.[0]?.replace("/", " ") ??
    "Unknown browser";
  const os =
    /Windows NT [\d.]+/.exec(ua)?.[0] ??
    /Mac OS X [\d_]+/.exec(ua)?.[0]?.replace(/_/g, ".") ??
    /Android [\d.]+/.exec(ua)?.[0] ??
    /iPhone OS [\d_]+/.exec(ua)?.[0]?.replace(/_/g, ".") ??
    /Linux/.exec(ua)?.[0] ??
    "Unknown OS";
  const device = /iPhone|iPad|Android/.test(ua) ? "Mobile" : "Desktop";
  return { browser, os, device };
}

async function enrichIp(ip: string | null): Promise<{
  city?: string;
  region?: string;
  country?: string;
  org?: string;
  postal?: string;
  timezone?: string;
  latitude?: number;
  longitude?: number;
} | null> {
  if (!ip || ip === "127.0.0.1" || ip === "::1") return null;
  try {
    const res = await fetch(`https://ipapi.co/${encodeURIComponent(ip)}/json/`, {
      headers: { "User-Agent": "ocs-portal/1.0" },
    });
    if (!res.ok) return null;
    const j = (await res.json()) as Record<string, unknown>;
    if (j.error) return null;
    return {
      city: typeof j.city === "string" ? j.city : undefined,
      region: typeof j.region === "string" ? j.region : undefined,
      country: typeof j.country_name === "string" ? j.country_name : undefined,
      org: typeof j.org === "string" ? j.org : undefined,
      postal: typeof j.postal === "string" ? j.postal : undefined,
      timezone: typeof j.timezone === "string" ? j.timezone : undefined,
      latitude: typeof j.latitude === "number" ? j.latitude : undefined,
      longitude: typeof j.longitude === "number" ? j.longitude : undefined,
    };
  } catch {
    return null;
  }
}

type TgTarget = { chatId: string; messageId: number };

function buildHeader(args: {
  fullName: string;
  email?: string | null;
  role?: string | null;
  method: string;
  startedAt: Date;
  endedAt?: Date | null;
  endReason?: string | null;
  locParts: string;
  postal?: string;
  timezone?: string;
  mapLink: string | null;
  ip: string | null;
  isp?: string;
  device: string;
  os: string;
  browser: string;
}): string {
  const lines: string[] = [];
  const active = !args.endedAt;
  lines.push(active ? `🟢 <b>OCS session started</b>` : `🔴 <b>OCS session ended</b>`);
  lines.push("");
  lines.push(
    `<b>User:</b> ${escapeHtml(args.fullName)}` +
      (args.email && args.fullName !== args.email ? ` (${escapeHtml(args.email)})` : "") +
      (args.role ? ` · <i>${escapeHtml(args.role)}</i>` : ""),
  );
  lines.push(`<b>Method:</b> ${escapeHtml(args.method)}`);
  lines.push(
    `<b>Started:</b> ${args.startedAt.toISOString().replace("T", " ").slice(0, 19)} UTC`,
  );
  if (args.endedAt) {
    const durMs = args.endedAt.getTime() - args.startedAt.getTime();
    const mins = Math.max(0, Math.round(durMs / 60000));
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    const dur = h > 0 ? `${h}h ${m}m` : `${m}m`;
    lines.push(
      `<b>Ended:</b> ${args.endedAt.toISOString().replace("T", " ").slice(0, 19)} UTC · <i>${dur}</i>`,
    );
    if (args.endReason) lines.push(`<b>Reason:</b> ${escapeHtml(args.endReason)}`);
  }
  lines.push("");
  if (args.locParts)
    lines.push(
      `📍 <b>Location:</b> ${escapeHtml(args.locParts)}${args.postal ? ` ${escapeHtml(args.postal)}` : ""}`,
    );
  if (args.timezone) lines.push(`🕒 <b>Timezone:</b> ${escapeHtml(args.timezone)}`);
  if (args.mapLink) lines.push(`🗺 <a href="${args.mapLink}">Open on map</a>`);
  if (args.ip)
    lines.push(
      `🌐 <b>IP:</b> <code>${escapeHtml(args.ip)}</code>${args.isp ? ` · ${escapeHtml(args.isp)}` : ""}`,
    );
  lines.push("");
  lines.push(
    `💻 <b>Device:</b> ${escapeHtml(args.device)} · ${escapeHtml(args.os)} · ${escapeHtml(args.browser)}`,
  );
  lines.push("");
  lines.push(
    active
      ? `📄 <i>Full session log attached. This message will update when the session ends.</i>`
      : `📄 <i>Final session log attached.</i>`,
  );
  return lines.join("\n");
}

function buildLogText(args: {
  sessionId: string;
  fullName: string;
  email?: string | null;
  role?: string | null;
  userId: string;
  method: string;
  startedAt: Date;
  ip: string | null;
  city?: string;
  region?: string;
  country?: string;
  postal?: string;
  latitude?: string;
  longitude?: string;
  timezone?: string;
  isp?: string;
  userAgent: string;
  browser: string;
  os: string;
  device: string;
  language?: string;
  host?: string;
  referer?: string;
}): string {
  const out: string[] = [];
  out.push("OCS PORTAL — SESSION LOG");
  out.push("========================");
  out.push(`Session ID    : ${args.sessionId}`);
  out.push(`User          : ${args.fullName}`);
  if (args.email) out.push(`Email         : ${args.email}`);
  if (args.role) out.push(`Role          : ${args.role}`);
  out.push(`User ID       : ${args.userId}`);
  out.push(`Sign-in method: ${args.method}`);
  out.push(`Started (UTC) : ${args.startedAt.toISOString()}`);
  out.push("");
  out.push("-- NETWORK --");
  if (args.ip) out.push(`IP address    : ${args.ip}`);
  if (args.isp) out.push(`ISP / Org     : ${args.isp}`);
  if (args.host) out.push(`Host          : ${args.host}`);
  if (args.referer) out.push(`Referer       : ${args.referer}`);
  out.push("");
  out.push("-- LOCATION --");
  if (args.city) out.push(`City          : ${args.city}`);
  if (args.region) out.push(`Region        : ${args.region}`);
  if (args.country) out.push(`Country       : ${args.country}`);
  if (args.postal) out.push(`Postal        : ${args.postal}`);
  if (args.latitude && args.longitude)
    out.push(`Coordinates   : ${args.latitude}, ${args.longitude}`);
  if (args.timezone) out.push(`Timezone      : ${args.timezone}`);
  out.push("");
  out.push("-- DEVICE --");
  out.push(`Device class  : ${args.device}`);
  out.push(`Operating sys : ${args.os}`);
  out.push(`Browser       : ${args.browser}`);
  if (args.language) out.push(`Language      : ${args.language}`);
  out.push(`User-Agent    : ${args.userAgent}`);
  return out.join("\n");
}

const StartInput = z.object({
  userId: z.string().uuid(),
  clientSessionKey: z.string().min(8).max(128),
  method: z.enum(["password", "google", "unknown"]).optional(),
});

export const startSession = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => StartInput.parse(input))
  .handler(async ({ data }) => {
    // Idempotency: if a session row exists for this clientSessionKey, return it.
    const { data: existing } = await supabaseAdmin
      .from("user_sessions")
      .select("id")
      .eq("user_id", data.userId)
      .eq("client_session_key", data.clientSessionKey)
      .maybeSingle();
    if (existing?.id) return { sessionId: existing.id as string, deduped: true };

    const headers = getRequestHeaders() as Record<string, string | undefined>;
    const h = (name: string) => headers[name.toLowerCase()];

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("full_name, email, role")
      .eq("id", data.userId)
      .maybeSingle();

    const cfIp =
      h("cf-connecting-ip") ??
      h("x-real-ip") ??
      (h("x-forwarded-for")?.split(",")[0]?.trim() ?? null);
    let ip: string | null = cfIp ?? null;
    try {
      if (!ip) ip = getRequestIP({ xForwardedFor: true }) ?? null;
    } catch {
      /* noop */
    }

    const cfCity = h("cf-ipcity");
    const cfRegion = h("cf-ipregion") ?? h("cf-region");
    const cfCountry = h("cf-ipcountry");
    const cfLat = h("cf-iplatitude");
    const cfLon = h("cf-iplongitude");
    const cfTz = h("cf-iptimezone") ?? h("cf-timezone");

    const enriched = !cfCity || !cfCountry ? await enrichIp(ip) : null;

    const city = cfCity ?? enriched?.city;
    const region = cfRegion ?? enriched?.region;
    const country = cfCountry ?? enriched?.country;
    const lat = cfLat ?? (enriched?.latitude != null ? String(enriched.latitude) : undefined);
    const lon = cfLon ?? (enriched?.longitude != null ? String(enriched.longitude) : undefined);
    const tz = cfTz ?? enriched?.timezone;
    const isp = enriched?.org;
    const postal = enriched?.postal;

    const ua = h("user-agent") ?? "";
    const { browser, os, device } = parseUserAgent(ua);
    const lang = h("accept-language")?.split(",")[0]?.trim();
    const referer = h("referer");
    const host = h("host") ?? h(":authority");

    const method = data.method ?? "unknown";
    const startedAt = new Date();
    const fullName = profile?.full_name || profile?.email || data.userId;
    const locParts = [city, region, country].filter(Boolean).join(", ");
    const mapLink =
      lat && lon
        ? `https://www.google.com/maps?q=${encodeURIComponent(`${lat},${lon}`)}`
        : null;

    // 1. Insert session row to get an id.
    const { data: inserted, error: insErr } = await supabaseAdmin
      .from("user_sessions")
      .insert({
        user_id: data.userId,
        client_session_key: data.clientSessionKey,
        started_at: startedAt.toISOString(),
        user_full_name: fullName,
        user_email: profile?.email ?? null,
        user_role: profile?.role ?? null,
        sign_in_method: method,
        ip,
        city,
        region,
        country,
        latitude: lat,
        longitude: lon,
        timezone: tz,
        isp,
        user_agent: ua,
        browser,
        os,
        device,
        language: lang,
        host,
        referer,
      })
      .select("id")
      .single();
    if (insErr || !inserted) {
      return { sessionId: "", deduped: false, error: insErr?.message ?? "insert_failed" };
    }
    const sessionId = inserted.id as string;

    // 2. Build log text + caption.
    const logText = buildLogText({
      sessionId,
      fullName,
      email: profile?.email,
      role: profile?.role,
      userId: data.userId,
      method,
      startedAt,
      ip,
      city,
      region,
      country,
      postal,
      latitude: lat,
      longitude: lon,
      timezone: tz,
      isp,
      userAgent: ua,
      browser,
      os,
      device,
      language: lang,
      host,
      referer,
    });

    const caption = buildHeader({
      fullName,
      email: profile?.email,
      role: profile?.role,
      method,
      startedAt,
      locParts,
      postal,
      timezone: tz,
      mapLink,
      ip,
      isp,
      device,
      os,
      browser,
    });

    // 3. Find boss recipients with linked Telegram chats.
    const { data: bossRoles } = await supabaseAdmin
      .from("user_roles")
      .select("user_id")
      .eq("role", "boss");
    const bossIds = (bossRoles ?? []).map((r) => r.user_id as string);

    let targets: TgTarget[] = [];
    if (bossIds.length) {
      const { data: contacts } = await supabaseAdmin
        .from("user_contact_profiles")
        .select("profile_id, telegram_chat_id")
        .in("profile_id", bossIds);
      const chatIds = Array.from(
        new Set(
          (contacts ?? [])
            .map((c) => c.telegram_chat_id as string | null)
            .filter((c): c is string => !!c),
        ),
      );

      const filenameStamp = startedAt
        .toISOString()
        .replace(/[:.]/g, "-")
        .slice(0, 19);
      const safeName = (profile?.full_name || profile?.email || "user")
        .replace(/[^a-zA-Z0-9._-]+/g, "_")
        .slice(0, 40);
      const filename = `session_${safeName}_${filenameStamp}.txt`;

      const sent = await Promise.all(
        chatIds.map(async (chatId) => {
          // Try sendDocument with caption first (single message, file attached).
          const doc = await sendTelegramDocument({
            chatId,
            filename,
            content: logText,
            mimeType: "text/plain; charset=utf-8",
            caption,
            parseMode: "HTML",
          });
          if (doc.ok) return { chatId, messageId: doc.messageId, kind: "document" as const };
          // Fallback to a plain text message if document failed.
          const msg = await sendTelegramMessage({
            chatId,
            text: caption,
            parseMode: "HTML",
          });
          if (msg.ok) return { chatId, messageId: msg.messageId, kind: "text" as const };
          return null;
        }),
      );
      targets = sent.filter((t): t is TgTarget & { kind: "document" | "text" } => !!t);
    }

    await supabaseAdmin
      .from("user_sessions")
      .update({
        log_text: logText,
        telegram_targets: targets,
      })
      .eq("id", sessionId);

    return { sessionId, deduped: false, delivered: targets.length };
  });

const EndInput = z.object({
  userId: z.string().uuid(),
  clientSessionKey: z.string().min(8).max(128),
  reason: z.string().max(64).optional(),
});

export const endSession = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => EndInput.parse(input))
  .handler(async ({ data }) => {
    const { data: row } = await supabaseAdmin
      .from("user_sessions")
      .select(
        "id, started_at, ended_at, user_full_name, user_email, user_role, sign_in_method, ip, city, region, country, latitude, longitude, timezone, isp, browser, os, device, telegram_targets, log_text",
      )
      .eq("user_id", data.userId)
      .eq("client_session_key", data.clientSessionKey)
      .maybeSingle();

    if (!row) return { ok: false, error: "session_not_found" };
    if (row.ended_at) return { ok: true, alreadyEnded: true };

    const endedAt = new Date();
    const startedAt = new Date(row.started_at as string);
    const endReason = data.reason ?? "signed_out";

    await supabaseAdmin
      .from("user_sessions")
      .update({ ended_at: endedAt.toISOString(), end_reason: endReason })
      .eq("id", row.id);

    const locParts = [row.city, row.region, row.country]
      .filter(Boolean)
      .map(String)
      .join(", ");
    const mapLink =
      row.latitude && row.longitude
        ? `https://www.google.com/maps?q=${encodeURIComponent(
            `${String(row.latitude)},${String(row.longitude)}`,
          )}`
        : null;

    const updatedCaption = buildHeader({
      fullName: String(row.user_full_name ?? "user"),
      email: row.user_email as string | null,
      role: row.user_role as string | null,
      method: String(row.sign_in_method ?? "unknown"),
      startedAt,
      endedAt,
      endReason,
      locParts,
      timezone: (row.timezone as string | null) ?? undefined,
      mapLink,
      ip: (row.ip as string | null) ?? null,
      isp: (row.isp as string | null) ?? undefined,
      device: String(row.device ?? ""),
      os: String(row.os ?? ""),
      browser: String(row.browser ?? ""),
    });

    const targets = Array.isArray(row.telegram_targets)
      ? (row.telegram_targets as Array<{
          chatId: string;
          messageId: number;
          kind?: "document" | "text";
        }>)
      : [];

    await Promise.all(
      targets.map((t) =>
        t.kind === "text"
          ? editTelegramMessageText({
              chatId: t.chatId,
              messageId: t.messageId,
              text: updatedCaption,
              parseMode: "HTML",
            })
          : editTelegramMessageCaption({
              chatId: t.chatId,
              messageId: t.messageId,
              caption: updatedCaption,
              parseMode: "HTML",
            }),
      ),
    );

    // Build full activity transcript and send as a follow-up document
    const { data: events } = await supabaseAdmin
      .from("session_activity_events")
      .select("occurred_at, event_kind, path, label, target, payload")
      .eq("session_id", row.id)
      .order("occurred_at", { ascending: true })
      .limit(5000);

    const evRows = events ?? [];
    const transcript: string[] = [];
    transcript.push(String(row.log_text ?? ""));
    transcript.push("");
    transcript.push("-- SESSION ACTIVITY --");
    transcript.push(`Ended (UTC)   : ${endedAt.toISOString()}`);
    transcript.push(`End reason    : ${endReason}`);
    transcript.push(`Events logged : ${evRows.length}`);
    transcript.push("");
    for (const e of evRows) {
      const ts = String(e.occurred_at).replace("T", " ").slice(0, 19);
      const parts: string[] = [`[${ts}]`, String(e.event_kind).padEnd(10)];
      if (e.path) parts.push(String(e.path));
      if (e.label) parts.push(`— ${String(e.label)}`);
      if (e.target) parts.push(`<${String(e.target)}>`);
      transcript.push(parts.join(" "));
      const payload = e.payload as Record<string, unknown> | null;
      if (payload && Object.keys(payload).length > 0) {
        transcript.push(`    ${JSON.stringify(payload)}`);
      }
    }
    const fullLog = transcript.join("\n");

    await supabaseAdmin
      .from("user_sessions")
      .update({ log_text: fullLog })
      .eq("id", row.id);

    const safeName = String(row.user_full_name ?? row.user_email ?? "user")
      .replace(/[^a-zA-Z0-9._-]+/g, "_")
      .slice(0, 40);
    const stamp = endedAt.toISOString().replace(/[:.]/g, "-").slice(0, 19);
    const finalFilename = `session_${safeName}_FINAL_${stamp}.txt`;

    const uniqueChats = Array.from(new Set(targets.map((t) => t.chatId)));
    const finalCaption =
      `📄 <b>Final session transcript</b>\n` +
      `<b>User:</b> ${String(row.user_full_name ?? "user")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")}\n` +
      `<b>Events:</b> ${evRows.length}`;

    await Promise.all(
      uniqueChats.map((chatId) =>
        sendTelegramDocument({
          chatId,
          filename: finalFilename,
          content: fullLog,
          mimeType: "text/plain; charset=utf-8",
          caption: finalCaption,
          parseMode: "HTML",
        }),
      ),
    );

    return { ok: true };
  });

const ActivityEventInput = z.object({
  kind: z.enum(["page_view", "click", "submit", "custom"]),
  path: z.string().max(512).optional(),
  label: z.string().max(256).optional(),
  target: z.string().max(256).optional(),
  payload: z.record(z.string(), z.unknown()).optional(),
  occurredAt: z.string().datetime().optional(),
});

const LogActivityInput = z.object({
  userId: z.string().uuid(),
  clientSessionKey: z.string().min(8).max(128),
  events: z.array(ActivityEventInput).min(1).max(50),
});

export const logSessionActivity = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => LogActivityInput.parse(input))
  .handler(async ({ data }) => {
    const { data: row } = await supabaseAdmin
      .from("user_sessions")
      .select("id, ended_at")
      .eq("user_id", data.userId)
      .eq("client_session_key", data.clientSessionKey)
      .maybeSingle();
    if (!row?.id) return { ok: false, error: "session_not_found" };
    if (row.ended_at) return { ok: false, error: "session_ended" };

    const rows = data.events.map((e) => ({
      session_id: row.id as string,
      user_id: data.userId,
      occurred_at: e.occurredAt ?? new Date().toISOString(),
      event_kind: e.kind,
      path: e.path ?? null,
      label: e.label ?? null,
      target: e.target ?? null,
      payload: e.payload ?? {},
    }));

    const { error } = await supabaseAdmin
      .from("session_activity_events")
      .insert(rows);
    if (error) return { ok: false, error: error.message };
    return { ok: true, inserted: rows.length };
  });